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

/// Bring the main window to the front — for the tray "Show" item and for a second launch.
///
/// Tauri's own `show()` / `unminimize()` are not enough here: the main window is created
/// minimised and hidden (`start_minimized`), and the `Resized` handler hides anything that
/// still reports as minimised. Restore *before* showing, then claim the foreground — the
/// sequence measured to work on this app (D-026). One routine for both callers keeps the
/// tray path and the second-launch path from drifting.
#[cfg(windows)]
fn reveal_main_window(app: &tauri::AppHandle) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        IsIconic, SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOW,
    };

    let Some(window) = app.get_webview_window("main") else {
        log::warn!("Reveal: no main window to show");
        return;
    };
    let Ok(handle) = window.hwnd() else {
        log::warn!("Reveal: main window has no HWND");
        return;
    };

    let hwnd = HWND(handle.0 as _);
    unsafe {
        if IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        }
        let _ = ShowWindow(hwnd, SW_SHOW);
        let _ = SetForegroundWindow(hwnd);
    }

    log::info!(
        "Reveal: visible={:?} minimized={:?}",
        window.is_visible(),
        window.is_minimized()
    );
}

#[cfg(not(windows))]
fn reveal_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Registered first, on purpose (D-026): the guard has to decide before autostart,
        // the tray webview or the 1 Hz tracker thread does anything. Two instances means
        // two writers on one database — every second recorded twice.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // A second launch is the user asking to see the window, not a second recorder.
            log::info!("Second launch detected - revealing the running instance");
            reveal_main_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
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

            // Logging is configured in **every** build, not only debug (D-024).
            // Without a logger, every `log::error!` on the write path is a no-op in the
            // shipped app, which turns "the insert failed" into "you had an idle day" —
            // that silence is how P2-1 stayed invisible. Logs sit next to the database
            // so a bug report can carry one file.
            let log_dir = app_data_dir.join("logs");
            let mut log_targets = vec![tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::Folder {
                    path: log_dir.clone(),
                    file_name: Some("activity-tracker".to_string()),
                },
            )];
            if cfg!(debug_assertions) {
                // Keep the console readable while developing.
                log_targets.push(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stdout,
                ));
            }
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .targets(log_targets)
                    // Bounded on disk: three files of at most 2 MB each.
                    .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(3))
                    .max_file_size(2 * 1024 * 1024)
                    .build(),
            )?;


            // Initialize database
            let db = database::init_database(app_data_dir)
                .expect("Failed to initialize database");

            // One-time migration: derive active (non-idle) seconds for window events
            // recorded before the column existed. Runs before the tracking loop starts
            // so it cannot stall capture; a failure is non-fatal because readers fall
            // back to duration_seconds (D-018).
            let backfill_started = std::time::Instant::now();
            match database::backfill_window_event_active_seconds(&db) {
                Ok(0) => {}
                Ok(filled) => log::info!(
                    "Backfilled active_seconds for {} window events in {:?}",
                    filled,
                    backfill_started.elapsed()
                ),
                Err(e) => log::error!("Backfill of window-event active seconds failed: {}", e),
            }

            // One-time migration: fold process names that differ only by case (D-021).
            match database::normalise_process_names(&db) {
                Ok((0, 0)) => {}
                Ok((folded, relabelled)) => log::info!(
                    "Normalised process names: {} app_usage rows folded, {} events relabelled",
                    folded,
                    relabelled
                ),
                Err(e) => log::error!("Process-name normalisation failed: {}", e),
            }

            // Reclaim pages left behind by a "clear all data" or a retention delete.
            // VACUUM rewrites the whole file under an exclusive lock, so it runs here —
            // before the tracking loop starts — and only when the freelist is large
            // enough to be worth the wait (D-027).
            if let Err(e) = database::vacuum_if_fragmented(&db) {
                log::error!("Startup vacuum failed: {}", e);
            }

            // Create tracker and start it
            let tracker = tracker::Tracker::new(db);

            // Read the start-minimized flag before the tracker moves into state
            let start_minimized = tracker
                .get_settings_snapshot()
                .get("start_minimized")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            tracker.start(app.handle().clone());
            tracker.start_power_sampling();

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
               
               let _ = tauri::tray::TrayIconBuilder::with_id("main")
                .icon(handle.default_window_icon().unwrap().clone())
                 .menu(&menu)
                 .on_menu_event(|app: &tauri::AppHandle, event| {
                    match event.id().as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            reveal_main_window(app);
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
                // Start minimized to tray when the setting is enabled
                if start_minimized {
                    let _ = main_window.hide();
                }

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
            commands::get_settings,
            commands::set_settings,
            commands::export_data,
            commands::get_all_app_usage,
            commands::get_cpu_snapshot,
            commands::is_tracking,
            commands::get_active_window,
            commands::get_app_usage,
            commands::get_daily_stats,
            commands::get_stats_range,
            commands::get_activity_timeline,
            commands::get_recent_events,
            commands::get_timeline_range_paginated,
            commands::get_timeline_range_for_app,
            commands::get_app_usage_range,
            commands::get_input_history,
            commands::get_input_history_range,
            commands::get_idle_seconds,
            commands::start_tracking,
            commands::stop_tracking,
            commands::clear_data,
            commands::get_user_stats,
            commands::get_unlocked_achievements,
            commands::get_app_icon,
        ])

        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Close the window segment that is still open before the process dies: a quit
            // kills the tracking thread mid-tick, and that segment is a real app period
            // (D-029). `try_state` keeps this harmless during an early-exit failure.
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app.try_state::<AppState>() {
                    if let Ok(tracker) = state.tracker.lock() {
                        tracker.flush_in_flight();
                    }
                }
            }
        });
}
