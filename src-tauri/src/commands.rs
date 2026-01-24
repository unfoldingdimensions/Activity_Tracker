//! Tauri commands for frontend-backend communication

use crate::tracker::Tracker;
use crate::windows_api::ActiveWindow;
use crate::database::{DailyStats, TimelineSegment, WindowEvent};
use std::sync::Mutex;
use tauri::State;

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
