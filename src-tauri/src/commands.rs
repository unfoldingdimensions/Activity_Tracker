//! Tauri commands for frontend-backend communication

use crate::tracker::Tracker;
use crate::windows_api::ActiveWindow;
use crate::database::{DailyStats, TimelineSegment, WindowEvent, UserStats};
use std::sync::Mutex;
use tauri::State;
use chrono::{Duration, NaiveDateTime};
use chrono::TimeZone;

/// App state managed by Tauri
pub struct AppState {
    pub tracker: Mutex<Tracker>,
}

/// Get the currently active window
#[tauri::command]
pub fn get_active_window(state: State<AppState>) -> Option<ActiveWindow> {
    state.tracker.lock().unwrap().get_current_window()
}

/// Get app usage for today
#[tauri::command]
pub fn get_app_usage(state: State<AppState>) -> Vec<AppUsageEntry> {
    state
        .tracker
        .lock()
        .unwrap()
        .get_today_app_usage()
        .into_iter()
        .map(|(name, seconds)| AppUsageEntry { name, seconds })
        .collect()
}

/// Get daily stats
#[tauri::command]
pub fn get_daily_stats(state: State<AppState>) -> Option<DailyStats> {
    state.tracker.lock().unwrap().get_today_stats()
}

/// Get stats for custom range
#[tauri::command]
pub fn get_stats_range(state: State<AppState>, start_iso: String, end_iso: String) -> DailyStats {
    let db = {
        let tracker = state.tracker.lock().unwrap();
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
    state.tracker.lock().unwrap().get_today_timeline()
}

/// Get recent window events
#[tauri::command]
pub fn get_recent_events(state: State<AppState>) -> Vec<WindowEvent> {
    state.tracker.lock().unwrap().get_recent_events()
}

/// Get events in range
#[tauri::command]
pub fn get_timeline_range(state: State<AppState>, start_iso: String, end_iso: String) -> Vec<WindowEvent> {
    state.tracker.lock().unwrap().get_events_range(&start_iso, &end_iso)
}

/// Get events for specific app in range
#[tauri::command]
pub fn get_timeline_range_for_app(state: State<AppState>, process_name: String, start_iso: String, end_iso: String) -> Vec<WindowEvent> {
    state.tracker.lock().unwrap().get_events_for_process_range(&process_name, &start_iso, &end_iso)
}

/// Get app usage in range
#[tauri::command]
pub fn get_app_usage_range(state: State<AppState>, start_date: String, end_date: String) -> Vec<AppUsageEntry> {
    state
        .tracker
        .lock()
        .unwrap()
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
    start_time = chrono::Utc.timestamp_opt(aligned_ts, 0).single().unwrap_or(start_time);

    let end_time = if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&end_iso) {
        dt.with_timezone(&chrono::Utc)
    } else {
        chrono::Utc::now()
    };

    let raw_data = state.tracker.lock().unwrap().get_input_history_range(
        &start_time.to_rfc3339_opts(chrono::SecondsFormat::Millis, true), 
        &end_iso,
    );
    
    let mut buckets = Vec::new();
    
    let diff_total = end_time.signed_duration_since(start_time);
    let total_minutes = diff_total.num_minutes();
    let num_buckets = (total_minutes / interval as i64) as u32 + 1;
    
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
    state.tracker.lock().unwrap().is_idle()
}

/// Get idle time in seconds
#[tauri::command]
pub fn get_idle_seconds(state: State<AppState>) -> u32 {
    state.tracker.lock().unwrap().get_idle_seconds()
}

/// Manually start tracking (usually auto-started)
#[tauri::command]
pub fn start_tracking(state: State<AppState>) {
    state.tracker.lock().unwrap().start();
}

/// Stop tracking
#[tauri::command]
pub fn stop_tracking(state: State<AppState>) {
    state.tracker.lock().unwrap().stop();
}

/// Clear all data
#[tauri::command]
pub fn clear_data(state: State<AppState>) -> Result<(), String> {
    state.tracker.lock().unwrap().clear_data().map_err(|e| e.to_string())
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
    state.tracker.lock().unwrap().get_user_stats()
}

/// Get unlocked achievements
#[tauri::command]
pub fn get_unlocked_achievements(state: State<AppState>) -> Vec<String> {
    state.tracker.lock().unwrap().get_unlocked_achievements()
}

/// Unlock achievement (debug/manual)
#[tauri::command]
pub fn unlock_achievement(state: State<AppState>, code: String) -> bool {
    state.tracker.lock().unwrap().unlock_achievement(&code)
}

