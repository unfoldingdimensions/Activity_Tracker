//! Main tracker module that coordinates activity monitoring

use crate::database;
use crate::windows_api;
use crate::input_monitor::InputMonitor;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use chrono::TimeZone;

/// The main tracker state
pub struct Tracker {
    pub db: Arc<Mutex<Connection>>,
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

            // Cleanup scheduling - run in separate thread to avoid blocking
            let last_cleanup = Arc::new(Mutex::new(std::time::Instant::now()));
            let cleanup_db = db.clone();
            let cleanup_running = is_running.clone();
            
            std::thread::spawn(move || {
                const CLEANUP_INTERVAL: Duration = Duration::from_secs(86400);
                const RETENTION_DAYS: u32 = 90;
                
                loop {
                    std::thread::sleep(Duration::from_secs(60)); // Check every minute
                    
                    let should_run = {
                        let running = cleanup_running.lock().unwrap();
                        if !*running { break; }
                        
                        let last = last_cleanup.lock().unwrap();
                        last.elapsed() >= CLEANUP_INTERVAL
                    };
                    
                    if should_run {
                        log::info!("Background cleanup: Starting database maintenance...");
                        
                        if let Ok(conn) = cleanup_db.lock() {
                            if let Err(e) = database::cleanup_old_snapshots(&conn, RETENTION_DAYS) {
                                log::error!("Background cleanup: Error cleaning snapshots: {}", e);
                            }
                            if let Err(e) = database::cleanup_old_input_activity(&conn, RETENTION_DAYS) {
                                log::error!("Background cleanup: Error cleaning input: {}", e);
                            }
                            if let Err(e) = database::cleanup_old_window_events(&conn, RETENTION_DAYS) {
                                log::error!("Background cleanup: Error cleaning events: {}", e);
                            }
                            // VACUUM is slow - consider removing or running less frequently
                            if let Err(e) = database::vacuum_database(&conn) {
                                log::error!("Background cleanup: Error vacuuming DB: {}", e);
                            }
                            log::info!("Background cleanup: Completed successfully");
                        }
                        
                        let mut last = last_cleanup.lock().unwrap();
                        *last = std::time::Instant::now();
                    }
                }
                log::info!("Background cleanup thread stopped");
            });

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
                        if let Err(e) = database::insert_activity_snapshot(&conn, &timestamp, is_idle, idle_seconds) {
                            log::error!("Failed to insert activity snapshot: {}", e);
                        }

                        // Record input activity if any
                        if input_counts.keystrokes > 0 || input_counts.mouse_clicks > 0 {
                            log::info!("Tracker: Recording input - Keys: {}, Clicks: {}", input_counts.keystrokes, input_counts.mouse_clicks);
                            if let Err(e) = database::insert_input_activity(
                                &conn, 
                                &timestamp, 
                                input_counts.keystrokes, 
                                input_counts.mouse_clicks, 
                                input_counts.mouse_distance
                            ) {
                                log::error!("Failed to insert input activity: {}", e);
                            }
                        }

                        // Track current app usage (1 second per tick)
                        if !is_idle {
                            if let Some(ref window) = active_window {
                                // Always record 1 second of usage for current app
                                if let Err(e) = database::upsert_app_usage(&conn, &today, &window.process_name, 1) {
                                    log::error!("Failed to upsert app usage: {}", e);
                                }
                                
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
                                            // Calculate actual end timestamp
                                            let end_timestamp = app_start_time.elapsed().as_secs();
                                            let actual_end = chrono::Utc::now() - chrono::Duration::seconds(end_timestamp as i64);
                                            let end_iso = actual_end.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
                                            
                                            if let Err(e) = database::insert_window_event(
                                                &conn, 
                                                &end_iso,
                                                prev_process,
                                                prev_title,
                                                duration
                                            ) {
                                                log::error!("Failed to insert window event: {}", e);
                                            }
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
                                if let Err(e) = database::add_xp(&conn, 10) {
                                    log::error!("Failed to add XP: {}", e);
                                }
                                xp_seconds_accumulator = 0;

                                // Check level up
                                if let Ok(stats) = database::get_user_stats(&conn) {
                                    let calculated_level = ((stats.total_xp as f64 / 100.0).sqrt().floor() as u32) + 1;
                                    if calculated_level > stats.current_level {
                                        if let Err(e) = database::update_level(&conn, calculated_level) {
                                            log::error!("Failed to update level: {}", e);
                                        } else {
                                            log::info!("Level Up! New Level: {}", calculated_level);
                                        }
                                    }
                                }
                            }

                            // Gamification Logic: Streak
                            if today != last_streak_check {
                                if let Err(e) = database::update_streak(&conn, &today) {
                                    log::error!("Failed to update streak: {}", e);
                                }
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

    /// Get the current active window
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

    /// Get daily stats for today (from local midnight to now)
    pub fn get_today_stats(&self) -> Option<database::DailyStats> {
        let today = windows_api::get_today();
        
        // Calculate UTC boundaries for local "today"
        let local_start = chrono::Local::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
        let local_end = chrono::Local::now().date_naive().and_hms_opt(23, 59, 59).unwrap();
        
        let start_utc = chrono::Local.from_local_datetime(&local_start).unwrap().with_timezone(&chrono::Utc);
        let end_utc = chrono::Local.from_local_datetime(&local_end).unwrap().with_timezone(&chrono::Utc);

        let start_iso = start_utc.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let end_iso = end_utc.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);

        if let Ok(conn) = self.db.lock() {
            database::get_daily_stats(&conn, &today, &start_iso, &end_iso).unwrap_or(None)
        } else {
            None
        }
    }
    
    /// Get activity timeline for today (from local midnight to now)
    pub fn get_today_timeline(&self) -> Vec<database::TimelineSegment> {
        let local_start = chrono::Local::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
        let local_end = chrono::Local::now().date_naive().and_hms_opt(23, 59, 59).unwrap();
        
        let start_utc = chrono::Local.from_local_datetime(&local_start).unwrap().with_timezone(&chrono::Utc);
        let end_utc = chrono::Local.from_local_datetime(&local_end).unwrap().with_timezone(&chrono::Utc);

        let start_iso = start_utc.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let end_iso = end_utc.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);

        if let Ok(conn) = self.db.lock() {
            database::get_activity_timeline(&conn, &start_iso, &end_iso).unwrap_or_default()
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

    /// Get input history in range
    pub fn get_input_history_range(&self, start_iso: &str, end_iso: &str) -> Vec<database::InputHistoryEntry> {
        if let Ok(conn) = self.db.lock() {
             database::get_input_history_range(&conn, start_iso, end_iso).unwrap_or_default()
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

    /// Get window events in range with pagination
    pub fn get_events_range_paginated(&self, start: &str, end: &str, limit: u32, offset: u32) -> Vec<database::WindowEvent> {
         if let Ok(conn) = self.db.lock() {
             database::get_window_events_in_range_paginated(&conn, start, end, limit, offset).unwrap_or_default()
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

