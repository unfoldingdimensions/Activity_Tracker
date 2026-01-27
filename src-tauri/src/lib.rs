//! Activity Tracker - Tauri Backend
//! 
//! Privacy-first Windows activity and productivity tracker.
//! Uses safe, non-invasive Windows APIs for monitoring.

mod commands;
mod database;
mod tracker;
mod windows_api;
mod icons;
mod input_monitor;


use commands::AppState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Get app data directory for database
            // On Windows, use a shared directory across users
            #[cfg(target_os = "windows")]
            let app_data_dir = {
                let program_data = std::env::var("ProgramData")
                    .unwrap_or_else(|_| "C:\\ProgramData".to_string());
                std::path::PathBuf::from(program_data).join("ActivityTracker")
            };

            #[cfg(not(target_os = "windows"))]
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            // Create directory if it doesn't exist
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create data directory");


            // Initialize database
            let db = database::init_database(app_data_dir)
                .expect("Failed to initialize database");

            // Create tracker and start it
            let tracker = tracker::Tracker::new(db);
            tracker.start();

            // Store in app state
            app.manage(AppState {
                tracker: Mutex::new(tracker),
            });

            log::info!("Activity Tracker initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_active_window,
            commands::get_app_usage,
            commands::get_daily_stats,
            commands::get_stats_range,
            commands::get_activity_timeline,
            commands::get_recent_events,
            commands::get_timeline_range,
            commands::get_timeline_range_paginated,
            commands::get_timeline_range_for_app,
            commands::get_app_usage_range,
            commands::get_input_history,
            commands::get_input_history_range,
            commands::is_idle,
            commands::get_idle_seconds,
            commands::start_tracking,
            commands::stop_tracking,
            commands::clear_data,
            commands::get_user_stats,
            commands::get_unlocked_achievements,
            commands::unlock_achievement,
            commands::get_app_icon,
        ])

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
