//! Main tracker module that coordinates activity monitoring

use crate::database;
use crate::windows_api;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// The main tracker state
pub struct Tracker {
    db: Arc<Mutex<Connection>>,
    is_running: Arc<Mutex<bool>>,
    current_window: Arc<Mutex<Option<windows_api::ActiveWindow>>>,
}

impl Tracker {
    /// Create a new tracker instance
    pub fn new(db: Connection) -> Self {
        Self {
            db: Arc::new(Mutex::new(db)),
            is_running: Arc::new(Mutex::new(false)),
            current_window: Arc::new(Mutex::new(None)),
        }
    }

    /// Start the tracking loop (called once on app start)
    pub fn start(&self) {
        let db = self.db.clone();
        let is_running = self.is_running.clone();
        let current_window = self.current_window.clone();

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
            let mut last_window: Option<windows_api::ActiveWindow> = None;
            let mut window_start_time = std::time::Instant::now();

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

                // Record activity snapshot
                if let Ok(conn) = db.lock() {
                    let _ = database::insert_activity_snapshot(&conn, &timestamp, is_idle, idle_seconds);

                    // Track window changes for app usage
                    if let Some(ref window) = active_window {
                        let window_changed = match &last_window {
                            Some(lw) => lw.process_name != window.process_name,
                            None => true,
                        };

                        if window_changed {
                            // Record time spent on previous window
                            if let Some(ref lw) = last_window {
                                let duration = window_start_time.elapsed().as_secs() as u32;
                                if duration > 0 {
                                    let _ = database::upsert_app_usage(&conn, &today, &lw.process_name, duration);
                                }
                            }

                            // Start tracking new window
                            last_window = Some(window.clone());
                            window_start_time = std::time::Instant::now();
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

    /// Get daily stats
    pub fn get_today_stats(&self) -> Option<database::DailyStats> {
        let today = windows_api::get_today();
        if let Ok(conn) = self.db.lock() {
            database::get_daily_stats(&conn, &today).unwrap_or(None)
        } else {
            None
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
