//! Activity Tracker - Tauri Backend
//! 
//! Privacy-first Windows activity and productivity tracker.
//! Uses safe, non-invasive Windows APIs for monitoring.

mod commands;
mod database;
mod export;
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

/// The tray popup is created on first open, not at launch.
///
/// Declared in `tauri.conf.json` it was a second resident webview from startup: a renderer
/// committing ~38 MB and holding a window most sessions never open (D-034 measured it). The
/// builder is the only place the popup's window options live now — `tauri.conf.json` no longer
/// describes it, so there is nothing left to drift from this function.
const TRAY_WINDOW_LABEL: &str = "tray";
const TRAY_WINDOW_PATH: &str = "/tray";

/// The popup window, created on first call and reused after that.
///
/// Returns `None` only if Chromium refuses to create the window — logged, not panicked, because
/// a missing popup must not take down the recorder.
fn tray_window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
    if let Some(existing) = app.get_webview_window(TRAY_WINDOW_LABEL) {
        return Some(existing);
    }

    let started = std::time::Instant::now();
    let window = match tauri::WebviewWindowBuilder::new(
        app,
        TRAY_WINDOW_LABEL,
        tauri::WebviewUrl::App(TRAY_WINDOW_PATH.into()),
    )
    .title("Activity Tracker")
    .inner_size(380.0, 540.0)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .visible(false)
    .background_color(tauri::window::Color(12, 10, 9, 255))
    .build()
    {
        Ok(window) => window,
        Err(err) => {
            log::error!("Failed to create the tray window: {err}");
            return None;
        }
    };

    // Click-outside-to-close belongs to the window it applies to: attached here, it cannot be
    // attached for one creation path and forgotten for another.
    let hiding = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            log::debug!("Tray window lost focus - hiding");
            let _ = hiding.hide();
        }
    });

    log::info!(
        "Tray window created on first open in {} ms",
        started.elapsed().as_millis()
    );
    Some(window)
}

/// Show the popup above the taskbar, or hide it if it is already visible.
fn toggle_tray_window(app: &tauri::AppHandle) {
    let Some(window) = tray_window(app) else {
        return;
    };

    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }

    // Position bottom right
    use tauri_plugin_positioner::{Position, WindowExt};
    let _ = window.move_window(Position::BottomRight);

    // Manually offset up by ~50-60 pixels to avoid taskbar overlap
    if let Ok(pos) = window.outer_position() {
        let _ = window.set_position(tauri::PhysicalPosition {
            x: pos.x,
            y: pos.y - 60,
        });
    }

    let _ = window.show();
    let _ = window.set_focus();
}

/// Point the autostart entry at the executable that is actually installed.
///
/// `auto-launch` writes `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\<app name>` and
/// only ever checks that the value **exists**, so a path recorded by an earlier launch is never
/// corrected. On this machine it recorded a cargo build output
/// (`E:/DevTools/activity-tracker/target/release/activity-tracker-v2.exe`), which meant sign-in
/// started a binary one build behind the installed copy — and one a rebuild cannot replace
/// while it runs (D-030).
///
/// The heal is a single registry write, and it is skipped when the running binary lives inside
/// a cargo target directory: a dev build must never register itself as what starts at sign-in.
#[cfg(windows)]
fn heal_autostart_entry(app: &tauri::AppHandle) {
    use tauri_plugin_autostart::ManagerExt;
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;

    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

    let exe = match std::env::current_exe() {
        Ok(path) => path.to_string_lossy().to_string(),
        Err(e) => {
            log::warn!("Autostart: cannot read the current executable path: {}", e);
            return;
        }
    };
    // Forward slashes, so the check reads the same whichever separator the path uses.
    let normalised = exe.replace('\\', "/").to_lowercase();
    if normalised.contains("/target/debug") || normalised.contains("/target/release") {
        log::info!("Autostart: running from a build tree; leaving the entry untouched");
        return;
    }

    let app_name = app.package_info().name.clone();
    let registered = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(RUN_KEY, KEY_READ)
        .ok()
        .and_then(|key| key.get_value::<String, _>(&app_name).ok());

    match registered {
        // Nothing registered: creating one here would resurrect an entry the user removed.
        None => log::debug!("Autostart: no entry to check"),
        Some(value) if value.trim().trim_matches('"').starts_with(&exe) => {
            log::debug!("Autostart entry already points at {}", exe);
        }
        Some(value) => {
            log::info!("Autostart entry points at {:?}; rewriting it to {}", value, exe);
            if let Err(e) = app.autolaunch().enable() {
                log::warn!("Autostart: rewriting the entry failed: {}", e);
            }
        }
    }
}

#[cfg(not(windows))]
fn heal_autostart_entry(_app: &tauri::AppHandle) {}

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


            // Correct an autostart entry left pointing at a build output (D-030).
            heal_autostart_entry(app.handle());

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
                        toggle_tray_window(tray.app_handle());
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
