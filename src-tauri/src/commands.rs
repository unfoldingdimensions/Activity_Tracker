//! Tauri commands for frontend-backend communication

use crate::tracker::Tracker;
use crate::windows_api::ActiveWindow;
use crate::database::{DailyStats, TimelineSegment, WindowEvent};
use std::sync::Mutex;
use tauri::State;
use chrono::{Local, Duration, NaiveDateTime};

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

/// Get input history bucketed by interval
#[tauri::command]
pub fn get_input_history(state: State<AppState>, interval_minutes: u32) -> Vec<InputHistoryBucket> {
    let now = Local::now();
    let start_time = now - Duration::hours(24);
    // Format for SQL specific string comparison if needed, but here we just need a rough start time string
    // Our DB function filters >= string. ISO string works for this.
    let start_iso = start_time.format("%Y-%m-%dT%H:%M:%S").to_string();
    
    let raw_data = state.tracker.lock().unwrap().get_input_history(&start_iso);
    
    let mut buckets = Vec::new();
    // Safety check for interval
    let interval = if interval_minutes == 0 { 60 } else { interval_minutes };
    let num_buckets = (24 * 60) / interval + 1; // +1 to cover edge cases
    
    // Initialize buckets
    for i in 0..num_buckets {
        let bucket_time = start_time + Duration::minutes((i * interval) as i64);
        buckets.push(InputHistoryBucket {
            time: bucket_time.format("%H:%M").to_string(),
            keystrokes: 0,
            mouse_clicks: 0,
        });
    }

    let start_naive = start_time.naive_local();

    // Fill buckets
    for entry in raw_data {
        // Try parsing with ms first
        let parsed = NaiveDateTime::parse_from_str(&entry.timestamp, "%Y-%m-%dT%H:%M:%S%.3f");
        
        if let Ok(ts) = parsed {
             let diff = ts.signed_duration_since(start_naive);
             let minutes = diff.num_minutes();
             
             if minutes >= 0 {
                 let bucket_idx = (minutes / interval as i64) as usize;
                 if bucket_idx < buckets.len() {
                     buckets[bucket_idx].keystrokes += entry.keystrokes;
                     buckets[bucket_idx].mouse_clicks += entry.mouse_clicks;
                 }
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
