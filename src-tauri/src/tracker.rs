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
}
