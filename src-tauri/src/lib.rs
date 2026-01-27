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

            // Initialize tray
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
               let quit = tauri::menu::MenuItem::with_id(&handle, "quit", "Quit", true, None::<&str>).unwrap();
               let show = tauri::menu::MenuItem::with_id(&handle, "show", "Open Dashboard", true, None::<&str>).unwrap();
               let menu = tauri::menu::Menu::with_items(&handle, &[&show, &quit]).unwrap();
               
               let _ = tauri::tray::TrayIconBuilder::new()
                 .icon(handle.default_window_icon().unwrap().clone())
                 .menu(&menu)
                 .on_menu_event(|app: &tauri::AppHandle, event| {
                    match event.id().as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                             if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                 })
                 .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                     if let tauri::tray::TrayIconEvent::Click { 
                        button: tauri::tray::MouseButton::Left, 
                        button_state: tauri::tray::MouseButtonState::Up, // Only trigger on release
                        .. 
                     } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("tray") {
                             let is_visible = window.is_visible().unwrap_or(false);
                             if is_visible {
                                 let _ = window.hide();
                             } else {
                                // Position bottom right
                                use tauri_plugin_positioner::{WindowExt, Position};
                                let _ = window.move_window(Position::BottomRight);
                                
                                // Manually offset up by ~50-60 pixels to avoid taskbar overlap
                                if let Ok(pos) = window.outer_position() {
                                    let _ = window.set_position(tauri::PhysicalPosition {
                                        x: pos.x,
                                        y: pos.y - 60, // Lift it above standard taskbar
                                    });
                                }
                                
                                let _ = window.show();
                                let _ = window.set_focus();
                             }
                        }
                     }
                 })
                 .build(&handle);
            });
            
            app.handle().plugin(tauri_plugin_positioner::init())?;

            // Configure main window behavior
            if let Some(main_window) = app.get_webview_window("main") {
                let main_window_clone = main_window.clone();
                main_window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            // Hide window instead of closing
                            api.prevent_close();
                            let _ = main_window_clone.hide();
                        }
                        tauri::WindowEvent::Resized(_) => {
                            if main_window_clone.is_minimized().unwrap_or(false) {
                                let _ = main_window_clone.hide();
                            }
                        }
                        _ => {}
                    }
                });
            }

            // Configure tray window behavior - hide on blur (click outside)
            if let Some(tray_window) = app.get_webview_window("tray") {
                let tray_window_clone = tray_window.clone();
                tray_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        log::info!("Tray window lost focus - hiding");
                        let _ = tray_window_clone.hide();
                    }
                });
            }

            log::info!("Activity Tracker initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::show_main_window, 
            commands::hide_tray_window,
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
