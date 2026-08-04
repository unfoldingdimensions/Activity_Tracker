//! Tauri commands for frontend-backend communication

use crate::tracker::Tracker;
use crate::windows_api::ActiveWindow;
use crate::database::{DailyStats, TimelineSegment, WindowEvent, UserStats};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{State, Manager, Emitter};
use crate::icons;
use chrono::{Duration, NaiveDateTime};

use chrono::TimeZone;

/// App state managed by Tauri
pub struct AppState {
    pub tracker: Mutex<Tracker>,
}

/// Show the main window (Dashboard)
#[derive(serde::Serialize, Clone)]
struct NavigatePayload {
    path: String,
}

#[tauri::command]
pub fn show_main_window(app_handle: tauri::AppHandle, path: Option<String>) {
    if let Some(window) = app_handle.get_webview_window("main") {
        if let Some(p) = path {
            let _ = window.emit("navigate", NavigatePayload { path: p });
        }
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Hide the tray popup window
#[tauri::command]
pub fn hide_tray_window(app_handle: tauri::AppHandle) {
    log::info!("hide_tray_window command invoked");
    if let Some(window) = app_handle.get_webview_window("tray") {
        log::info!("Found tray window, hiding it");
        let _ = window.hide();
    } else {
        log::warn!("Tray window not found");
    }
}

/// Enable/disable recording of window titles (privacy setting)
#[tauri::command]
pub fn set_track_window_titles(state: State<AppState>, enabled: bool) {
    if let Ok(tracker) = state.tracker.lock() {
        tracker.set_track_titles(enabled);
    } else {
        log::error!("Failed to lock tracker for set_track_window_titles");
    }
}

/// Get all stored settings (JSON key-value map). Defaults are applied
/// client-side; only explicitly-set values are returned.
#[tauri::command]
pub fn get_settings(state: State<AppState>) -> HashMap<String, serde_json::Value> {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for get_settings");
        return HashMap::new();
    };
    tracker.get_settings_snapshot()
}

/// Persist settings to the database and apply them to the runtime tracker.
#[tauri::command]
pub fn set_settings(state: State<AppState>, settings: HashMap<String, serde_json::Value>) -> Result<(), String> {
    // Persist to the database first
    let db = {
        let Ok(tracker) = state.tracker.lock() else {
            return Err("Failed to lock tracker".to_string());
        };
        tracker.db.clone()
    };

    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        for (key, value) in &settings {
            if let Err(e) = crate::database::set_setting(&conn, key, &value.to_string()) {
                log::error!("Failed to persist setting '{}': {}", key, e);
            }
        }
    }

    // Apply to the runtime cache so the loop/cleanup pick it up immediately
    if let Ok(tracker) = state.tracker.lock() {
        for (key, value) in settings {
            tracker.apply_setting(key, value);
        }
    }

    Ok(())
}

/// Check whether tracking is currently active
#[tauri::command]
pub fn is_tracking(state: State<AppState>) -> bool {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for is_tracking");
        return false;
    };
    tracker.is_running()
}

/// Get the currently active window
#[tauri::command]
pub fn get_active_window(state: State<AppState>) -> Option<ActiveWindow> {
    state.tracker.lock().ok()?.get_current_window()
}

/// Get app usage for today
#[tauri::command]
pub fn get_app_usage(state: State<AppState>) -> Vec<AppUsageEntry> {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for get_app_usage");
        return Vec::new();
    };
    tracker
        .get_today_app_usage()
        .into_iter()
        .map(|(name, seconds)| AppUsageEntry { name, seconds })
        .collect()
}

/// Get daily stats
#[tauri::command]
pub fn get_daily_stats(state: State<AppState>) -> Option<DailyStats> {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for get_daily_stats");
        return None;
    };
    tracker.get_today_stats()
}

/// Get stats for custom range
#[tauri::command]
pub fn get_stats_range(state: State<AppState>, start_iso: String, end_iso: String) -> DailyStats {
    let db = {
        let Ok(tracker) = state.tracker.lock() else {
            log::error!("Failed to lock tracker for get_stats_range");
            return DailyStats {
                total_active_seconds: 0,
                total_idle_seconds: 0,
                total_keystrokes: 0,
                total_mouse_clicks: 0,
                total_mouse_distance: 0,
            };
        };
        tracker.db.clone()
    };
    
    if let Ok(conn) = db.lock() {
        return crate::database::get_stats_range(&conn, &start_iso, &end_iso).unwrap_or(DailyStats {
            total_active_seconds: 0,
            total_idle_seconds: 0,
            total_keystrokes: 0,
            total_mouse_clicks: 0,
            total_mouse_distance: 0,
        });
    }

    DailyStats {
        total_active_seconds: 0,
        total_idle_seconds: 0,
        total_keystrokes: 0,
        total_mouse_clicks: 0,
        total_mouse_distance: 0,
    }
}

/// Get activity timeline
#[tauri::command]
pub fn get_activity_timeline(state: State<AppState>) -> Vec<TimelineSegment> {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for get_activity_timeline");
        return Vec::new();
    };
    tracker.get_today_timeline()
}

/// Get recent window events
#[tauri::command]
pub fn get_recent_events(state: State<AppState>) -> Vec<WindowEvent> {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for get_recent_events");
        return Vec::new();
    };
    tracker.get_recent_events()
}

/// Get events in range
#[tauri::command]
pub fn get_timeline_range(state: State<AppState>, start_iso: String, end_iso: String) -> Vec<WindowEvent> {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for get_timeline_range");
        return Vec::new();
    };
    tracker.get_events_range(&start_iso, &end_iso)
}

/// Get events in range with pagination
#[tauri::command]
pub fn get_timeline_range_paginated(state: State<AppState>, start_iso: String, end_iso: String, limit: u32, offset: u32) -> Vec<WindowEvent> {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for get_timeline_range_paginated");
        return Vec::new();
    };
    tracker.get_events_range_paginated(&start_iso, &end_iso, limit, offset)
}

/// Get events for specific app in range
#[tauri::command]
pub fn get_timeline_range_for_app(state: State<AppState>, process_name: String, start_iso: String, end_iso: String) -> Vec<WindowEvent> {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for get_timeline_range_for_app");
        return Vec::new();
    };
    tracker.get_events_for_process_range(&process_name, &start_iso, &end_iso)
}

/// Get app usage in range
#[tauri::command]
pub fn get_app_usage_range(state: State<AppState>, start_date: String, end_date: String) -> Vec<AppUsageEntry> {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for get_app_usage_range");
        return Vec::new();
    };
    tracker
        .get_app_usage_range(&start_date, &end_date)
        .into_iter()
        .map(|(name, seconds)| AppUsageEntry { name, seconds })
        .collect()
}

/// Get input history bucketed by interval (last 24h)
#[tauri::command]
pub fn get_input_history(state: State<AppState>, interval_minutes: u32) -> Vec<InputHistoryBucket> {
    let now = chrono::Utc::now();
    let start_time = now - Duration::hours(24);
    let end_time = now;
    
    get_input_history_range(state, start_time.to_rfc3339_opts(chrono::SecondsFormat::Secs, true), end_time.to_rfc3339_opts(chrono::SecondsFormat::Secs, true), interval_minutes)
}

/// Get input history bucketed by interval in range
#[tauri::command]
pub fn get_input_history_range(state: State<AppState>, start_iso: String, end_iso: String, interval_minutes: u32) -> Vec<InputHistoryBucket> {
    let interval = if interval_minutes == 0 { 60 } else { interval_minutes };

    
    let mut start_time = if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&start_iso) {
        dt.with_timezone(&chrono::Utc)
    } else {
        return Vec::new();
    };

    // Align start_time down to the interval boundary
    let ts = start_time.timestamp();
    let alignment_seconds = interval as i64 * 60;
    let aligned_ts = (ts / alignment_seconds) * alignment_seconds;
    start_time = chrono::DateTime::from_timestamp(aligned_ts, 0)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .unwrap_or(start_time);

    let end_time = if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&end_iso) {
        dt.with_timezone(&chrono::Utc)
    } else {
        chrono::Utc::now()
    };

    let raw_data = match state.tracker.lock() {
        Ok(tracker) => tracker.get_input_history_range(
            &start_time.to_rfc3339_opts(chrono::SecondsFormat::Millis, true), 
            &end_iso,
        ),
        Err(_) => {
            log::error!("Failed to lock tracker for get_input_history_range");
            Vec::new()
        }
    };
    
    let mut buckets = Vec::new();
    
    let diff_total = end_time.signed_duration_since(start_time);
    let total_minutes = diff_total.num_minutes().max(0);
    // Exact bucket count: ceil(minutes / interval), so no empty trailing bucket
    let num_buckets = total_minutes.div_ceil(interval as i64).max(1) as u32;
    
    // Initialize buckets
    for i in 0..num_buckets {
        let bucket_time = start_time + Duration::minutes((i * interval) as i64);
        buckets.push(InputHistoryBucket {
            time: bucket_time.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            keystrokes: 0,
            mouse_clicks: 0,
        });
    }


    // Fill buckets
    for entry in raw_data {
        let timestamp = if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&entry.timestamp) {
            dt.with_timezone(&chrono::Utc)
        } else if let Ok(naive) = NaiveDateTime::parse_from_str(&entry.timestamp, "%Y-%m-%dT%H:%M:%S%.3f") {
            chrono::Utc.from_utc_datetime(&naive)
        } else {
            continue;
        };

        let diff = timestamp.signed_duration_since(start_time);
        let minutes = diff.num_minutes();
             
        if minutes >= 0 {
            let bucket_idx = (minutes / interval as i64) as usize;
            if bucket_idx < buckets.len() {
                buckets[bucket_idx].keystrokes += entry.keystrokes;
                buckets[bucket_idx].mouse_clicks += entry.mouse_clicks;
            }
        }
    }
    
    buckets
}

/// Check if the system is idle
#[tauri::command]
pub fn is_idle(state: State<AppState>) -> bool {
    let Ok(tracker) = state.tracker.lock() else {
        return false;
    };
    tracker.is_idle()
}

/// Get idle time in seconds
#[tauri::command]
pub fn get_idle_seconds(state: State<AppState>) -> u32 {
    let Ok(tracker) = state.tracker.lock() else {
        return 0;
    };
    tracker.get_idle_seconds()
}

/// Manually start tracking (usually auto-started)
#[tauri::command]
pub fn start_tracking(state: State<AppState>) {
    if let Ok(tracker) = state.tracker.lock() {
        tracker.start();
    } else {
        log::error!("Failed to lock tracker for start_tracking");
    }
}

/// Stop tracking
#[tauri::command]
pub fn stop_tracking(state: State<AppState>) {
    if let Ok(tracker) = state.tracker.lock() {
        tracker.stop();
    } else {
        log::error!("Failed to lock tracker for stop_tracking");
    }
}

/// Clear all data
#[tauri::command]
pub fn clear_data(state: State<AppState>) -> Result<(), String> {
    let Ok(tracker) = state.tracker.lock() else {
        return Err("Failed to lock tracker".to_string());
    };
    tracker.clear_data().map_err(|e| e.to_string())?;

    // Clear cached app icons so "Clear All Data" fully resets stored artifacts
    #[cfg(target_os = "windows")]
    let base_dir = {
        let program_data = std::env::var("ProgramData")
            .unwrap_or_else(|_| "C:\\ProgramData".to_string());
        std::path::PathBuf::from(program_data).join("ActivityTracker")
    };
    #[cfg(not(target_os = "windows"))]
    let base_dir = std::env::temp_dir();
    let _ = std::fs::remove_dir_all(base_dir.join("icons"));

    Ok(())
}

/// App usage entry for frontend
#[derive(serde::Serialize)]
pub struct AppUsageEntry {
    pub name: String,
    pub seconds: u32,
}

#[derive(serde::Serialize)]
pub struct InputHistoryBucket {
    pub time: String,
    pub keystrokes: u32,
    pub mouse_clicks: u32,
}

/// Get user stats
#[tauri::command]
pub fn get_user_stats(state: State<AppState>) -> Option<UserStats> {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for get_user_stats");
        return None;
    };
    tracker.get_user_stats()
}

/// Get unlocked achievements
#[tauri::command]
pub fn get_unlocked_achievements(state: State<AppState>) -> Vec<String> {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for get_unlocked_achievements");
        return Vec::new();
    };
    tracker.get_unlocked_achievements()
}

/// Unlock achievement (debug/manual)
#[tauri::command]
pub fn unlock_achievement(state: State<AppState>, code: String) -> bool {
    let Ok(tracker) = state.tracker.lock() else {
        log::error!("Failed to lock tracker for unlock_achievement");
        return false;
    };
    tracker.unlock_achievement(&code)
}

/// Get the application icon as base64 string
/// Runs the (potentially slow) icon extraction on a blocking thread to avoid
/// stalling the UI event loop.
#[tauri::command]
pub async fn get_app_icon(process_name: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        let base_dir = {
            let program_data = std::env::var("ProgramData")
                .unwrap_or_else(|_| "C:\\ProgramData".to_string());
            std::path::PathBuf::from(program_data).join("ActivityTracker")
        };

        #[cfg(not(target_os = "windows"))]
        let base_dir = std::env::temp_dir();

        let cache_dir = base_dir.join("icons");
        if !cache_dir.exists() {
            let _ = std::fs::create_dir_all(&cache_dir);
        }

        icons::get_app_icon_base64(&process_name, &cache_dir)
    })
    .await
    .ok()
    .flatten()
}


