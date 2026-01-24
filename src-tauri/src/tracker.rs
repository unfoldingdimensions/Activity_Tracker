//! Main tracker module that coordinates activity monitoring

use crate::database;
use crate::windows_api;
use crate::input_monitor::InputMonitor;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// The main tracker state
pub struct Tracker {
    db: Arc<Mutex<Connection>>,
    is_running: Arc<Mutex<bool>>,
    current_window: Arc<Mutex<Option<windows_api::ActiveWindow>>>,
    input_monitor: Arc<InputMonitor>,
}

impl Tracker {
    /// Create a new tracker instance
    pub fn new(db: Connection) -> Self {
        Self {
            db: Arc::new(Mutex::new(db)),
            is_running: Arc::new(Mutex::new(false)),
            current_window: Arc::new(Mutex::new(None)),
            input_monitor: Arc::new(InputMonitor::new()),
        }
    }

    /// Start the tracking loop (called once on app start)
    pub fn start(&self) {
        let db = self.db.clone();
        let is_running = self.is_running.clone();
        let current_window = self.current_window.clone();
        let input_monitor = self.input_monitor.clone();

        // Set running flag
        {
            let mut running = is_running.lock().unwrap();
            if *running {
                log::warn!("Tracker is already running");
                return;
            }
            *running = true;
        }

        log::info!("Starting activity tracker...");

        // Spawn the tracking loop
        std::thread::spawn(move || {
            let mut current_process: Option<String> = None;
            let mut current_title: Option<String> = None;
            let mut app_start_time = std::time::Instant::now();
            
            // Gamification accumulators
            let mut xp_seconds_accumulator = 0;
            let mut last_streak_check = String::new(); // Date string

            loop {
                // Check if we should stop
                {
                    let running = is_running.lock().unwrap();
                    if !*running {
                        log::info!("Tracker stopped");
                        break;
                    }
                }

                // Get current state
                let idle_seconds = windows_api::get_idle_seconds();
                let is_idle = idle_seconds > 60;
                let timestamp = windows_api::get_timestamp();
                let today = windows_api::get_today();

                // Get active window
                let active_window = windows_api::get_active_window();

                // Update current window for frontend queries
                {
                    let mut cw = current_window.lock().unwrap();
                    *cw = active_window.clone();
                }

                // Get input counts since last tick
                let input_counts = input_monitor.get_and_reset();

                // Record activity and app usage every second
                if let Ok(conn) = db.lock() {
                    let _ = database::insert_activity_snapshot(&conn, &timestamp, is_idle, idle_seconds);

                    // Record input activity if any
                    if input_counts.keystrokes > 0 || input_counts.mouse_clicks > 0 {
                        log::info!("Tracker: Recording input - Keys: {}, Clicks: {}", input_counts.keystrokes, input_counts.mouse_clicks);
                        let _ = database::insert_input_activity(
                            &conn, 
                            &timestamp, 
                            input_counts.keystrokes, 
                            input_counts.mouse_clicks, 
                            input_counts.mouse_distance
                        );
                    }

                    // Track current app usage (1 second per tick)
                    if !is_idle {
                        if let Some(ref window) = active_window {
                            // Always record 1 second of usage for current app
                            let _ = database::upsert_app_usage(&conn, &today, &window.process_name, 1);
                            
                            // Check for Window Switch
                            let process_changed = match &current_process {
                                Some(p) => p != &window.process_name,
                                None => true,
                            };
                            
                            if process_changed {
                                // Close out previous event
                                if let Some(ref prev_process) = current_process {
                                    let duration = app_start_time.elapsed().as_secs() as u32;
                                    let prev_title = current_title.as_deref().unwrap_or("");
                                    
                                    if duration > 0 {
                                        let _ = database::insert_window_event(
                                            &conn, 
                                            &windows_api::get_timestamp(), // Approximate end time
                                            prev_process,
                                            prev_title,
                                            duration
                                        );
                                    }
                                }

                                log::info!("Window changed to: {}", window.process_name);
                                current_process = Some(window.process_name.clone());
                                current_title = Some(window.window_title.clone());
                                app_start_time = std::time::Instant::now();
                            } else {
                                // Update current title if changed
                                if let Some(ref title) = current_title {
                                    if title != &window.window_title {
                                        current_title = Some(window.window_title.clone());
                                    }
                                } else {
                                    current_title = Some(window.window_title.clone());
                                }
                            }
                        }
                    
                        // Gamification Logic: XP & Leveling
                        xp_seconds_accumulator += 1;
                        if xp_seconds_accumulator >= 60 {
                            // Award 10 XP per minute of active time
                            let _ = database::add_xp(&conn, 10);
                            xp_seconds_accumulator = 0;

                            // Check level up (Simple formula: Level * 100 XP required for next level)
                            // Or cumulative: Level = floor(sqrt(total_xp / 100)) + 1
                            if let Ok(stats) = database::get_user_stats(&conn) {
                                let calculated_level = ((stats.total_xp as f64 / 100.0).sqrt().floor() as u32) + 1;
                                if calculated_level > stats.current_level {
                                    let _ = database::update_level(&conn, calculated_level);
                                    log::info!("Level Up! New Level: {}", calculated_level);
                                    // Could emit an event here if we had the window handle
                                }
                            }
                        }

                        // Gamification Logic: Streak
                        // Check once per tick if date changed (or on startup)
                        if today != last_streak_check {
                            let _ = database::update_streak(&conn, &today);
                            last_streak_check = today.clone();
                        }
                    }
                }

                // Sleep for 1 second
                std::thread::sleep(Duration::from_secs(1));
            }
        });
    }

    /// Stop the tracking loop
    pub fn stop(&self) {
        let mut running = self.is_running.lock().unwrap();
        *running = false;
        log::info!("Stopping activity tracker...");
    }

    /// Ge the current active window
    pub fn get_current_window(&self) -> Option<windows_api::ActiveWindow> {
        self.current_window.lock().unwrap().clone()
    }

    /// Get app usage for today
    pub fn get_today_app_usage(&self) -> Vec<(String, u32)> {
        let today = windows_api::get_today();
        if let Ok(conn) = self.db.lock() {
            database::get_app_usage(&conn, &today).unwrap_or_default()
        } else {
            Vec::new()
        }
    }

    /// Get daily stats
    pub fn get_today_stats(&self) -> Option<database::DailyStats> {
        let today = windows_api::get_today();
        if let Ok(conn) = self.db.lock() {
            database::get_daily_stats(&conn, &today).unwrap_or(None)
        } else {
            None
        }
    }
    
    /// Get activity timeline for today
    pub fn get_today_timeline(&self) -> Vec<database::TimelineSegment> {
        let today = windows_api::get_today();
        if let Ok(conn) = self.db.lock() {
            database::get_activity_timeline(&conn, &today).unwrap_or_default()
        } else {
            Vec::new()
        }
    }
    
    /// Get recent window events
    pub fn get_recent_events(&self) -> Vec<database::WindowEvent> {
        if let Ok(conn) = self.db.lock() {
             database::get_recent_window_events(&conn).unwrap_or_default()
        } else {
            Vec::new()
        }
    }

    /// Get input history
    pub fn get_input_history(&self, since_iso: &str) -> Vec<database::InputHistoryEntry> {
        if let Ok(conn) = self.db.lock() {
             database::get_input_history_since(&conn, since_iso).unwrap_or_default()
        } else {
            Vec::new()
        }
    }
    
    /// Get window events in range
    pub fn get_events_range(&self, start: &str, end: &str) -> Vec<database::WindowEvent> {
         if let Ok(conn) = self.db.lock() {
             database::get_window_events_in_range(&conn, start, end).unwrap_or_default()
         } else {
             Vec::new()
         }
    }

    /// Get window events for process in range
    pub fn get_events_for_process_range(&self, process_name: &str, start: &str, end: &str) -> Vec<database::WindowEvent> {
         if let Ok(conn) = self.db.lock() {
             database::get_window_events_for_process_in_range(&conn, process_name, start, end).unwrap_or_default()
         } else {
             Vec::new()
         }
    }

    /// Get app usage in range
    pub fn get_app_usage_range(&self, start: &str, end: &str) -> Vec<(String, u32)> {
         if let Ok(conn) = self.db.lock() {
             database::get_app_usage_in_range(&conn, start, end).unwrap_or_default()
         } else {
             Vec::new()
         }
    }

    /// Clear all data
    pub fn clear_data(&self) -> Result<(), rusqlite::Error> {
        if let Ok(conn) = self.db.lock() {
            database::clear_database(&conn)
        } else {
            Ok(())
        }
    }

    /// Check if currently idle
    pub fn is_idle(&self) -> bool {
        windows_api::is_system_idle()
    }

    /// Get idle seconds
    pub fn get_idle_seconds(&self) -> u32 {
        windows_api::get_idle_seconds()
    }
    /// Get user gamification stats
    pub fn get_user_stats(&self) -> Option<database::UserStats> {
        if let Ok(conn) = self.db.lock() {
            database::get_user_stats(&conn).ok()
        } else {
            None
        }
    }

    /// Get unlocked achievements
    pub fn get_unlocked_achievements(&self) -> Vec<String> {
        if let Ok(conn) = self.db.lock() {
            database::get_unlocked_achievements(&conn).unwrap_or_default()
        } else {
            Vec::new()
        }
    }

    /// Unlock an achievement manually (for testing/future logic)
    pub fn unlock_achievement(&self, code: &str) -> bool {
        if let Ok(conn) = self.db.lock() {
            let timestamp = windows_api::get_timestamp();
            database::unlock_achievement(&conn, code, &timestamp).is_ok()
        } else {
            false
        }
    }
}

