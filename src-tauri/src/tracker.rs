//! Main tracker module that coordinates activity monitoring

use crate::database;
use crate::windows_api;
use crate::input_monitor::InputMonitor;
use rusqlite::Connection;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use chrono::{Timelike, TimeZone};
use tauri::Emitter;
use tauri_plugin_notification::NotificationExt;

/// Compact duration like "2h 5m" / "45m" for limit notifications
fn format_duration_compact(seconds: u64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else {
        format!("{}m", minutes)
    }
}

/// Native notification + frontend event for an unlocked achievement
fn notify_achievement(app: &tauri::AppHandle, title: &str, xp: u32) {
    let _ = app
        .notification()
        .builder()
        .title(format!("Achievement unlocked: {}", title))
        .body(format!("+{} XP", xp))
        .show();
    let _ = app.emit(
        "achievement-unlocked",
        serde_json::json!({ "title": title, "xp": xp }),
    );
    log::info!("Achievement unlocked: {} (+{} XP)", title, xp);
}

/// Native notification for streak milestones
fn notify_streak_milestone(app: &tauri::AppHandle, streak: u32) {
    let title = format!("{} day streak!", streak);
    let body = if streak >= 30 {
        "Remarkable consistency. Your habits are compounding."
    } else if streak >= 7 {
        "A full week of activity. Keep the momentum going."
    } else {
        "Keep showing up every day."
    };
    let _ = app.notification().builder().title(&title).body(body).show();
    log::info!("Streak milestone reached: {} days", streak);
}

/// Distraction guard: fire a notification (once per app per day) when an
/// app's usage crosses its configured daily limit.
fn check_app_limits(
    conn: &Connection,
    today: &str,
    settings: &Mutex<HashMap<String, serde_json::Value>>,
    app: &tauri::AppHandle,
    notified: &Mutex<HashSet<String>>,
) {
    let limits: HashMap<String, u64> = {
        let Ok(guard) = settings.lock() else {
            return;
        };
        match guard.get("app_limits") {
            Some(value) => serde_json::from_value(value.clone()).unwrap_or_default(),
            None => return,
        }
    };
    if limits.is_empty() {
        return;
    }

    let usage = match database::get_app_usage(conn, today) {
        Ok(usage) => usage,
        Err(e) => {
            log::error!("Distraction guard: failed to read app usage: {}", e);
            return;
        }
    };

    let Ok(mut notified_guard) = notified.lock() else {
        return;
    };

    for (app_name, seconds) in usage {
        let lower = app_name.to_lowercase();
        for (pattern, limit) in &limits {
            if pattern.is_empty() || !lower.contains(&pattern.to_lowercase()) {
                continue;
            }
            if (seconds as u64) < *limit {
                continue;
            }

            let key = format!("{}|{}|{}", lower, pattern.to_lowercase(), today);
            if !notified_guard.insert(key) {
                continue;
            }

            let title = format!("Daily limit reached: {}", app_name);
            let body = format!(
                "{} used today (limit {}). Time for a switch?",
                format_duration_compact(seconds as u64),
                format_duration_compact(*limit)
            );
            if let Err(e) = app.notification().builder().title(&title).body(&body).show() {
                log::error!("Distraction guard: failed to send notification: {}", e);
            }
            let _ = app.emit(
                "limit-reached",
                serde_json::json!({
                    "app": app_name,
                    "limit_seconds": limit,
                    "usage_seconds": seconds,
                }),
            );
            // Amber tray state: swap the tray icon to the amber variant
            if let Some(tray) = app.tray_by_id("main") {
                if let Some(png) = crate::icons::amber_tray_icon_png(app) {
                    if let Ok(image) = tauri::image::Image::from_bytes(&png) {
                        let _ = tray.set_icon(Some(image));
                    }
                }
            }
            log::info!("Distraction guard: {} exceeded its daily limit", app_name);
        }
    }
}

/// Replace every occurrence of each keyword (case-insensitive) in `title`
/// with a mask of bullet characters ("•").
///
/// Matching runs over a char-flattened lowercase view of the title. That keeps
/// case-insensitive search correct when lowercasing changes a char's UTF-8
/// length (e.g. 'İ' → "i̇") — the previous byte-based `to_lowercase().find`
/// could desync the offset and either mask the wrong span or panic on a
/// non-char-boundary slice. All indexing here is char-indexed, and every
/// matched source char becomes a single bullet.
fn redact_title(title: &str, keywords: &[String]) -> String {
    if title.is_empty() || keywords.is_empty() {
        return title.to_string();
    }

    let chars: Vec<char> = title.chars().collect();
    let mut masked: Vec<bool> = vec![false; chars.len()];

    for keyword in keywords {
        if keyword.is_empty() {
            continue;
        }

        // Flattened lowercase of each char, plus which source char produced
        // each lowercase char (one source char can lowercase to several).
        let mut lower: Vec<char> = Vec::new();
        let mut lower_origin: Vec<usize> = Vec::new();
        for (i, &c) in chars.iter().enumerate() {
            for lc in c.to_lowercase() {
                lower.push(lc);
                lower_origin.push(i);
            }
        }

        let needle: Vec<char> = keyword.chars().flat_map(|c| c.to_lowercase()).collect();
        if needle.is_empty() {
            continue;
        }

        let mut start = 0usize;
        while start + needle.len() <= lower.len() {
            if &lower[start..start + needle.len()] == needle.as_slice() {
                for &origin in &lower_origin[start..start + needle.len()] {
                    masked[origin] = true;
                }
                start += needle.len();
            } else {
                start += 1;
            }
        }
    }

    let mut out = String::with_capacity(title.len());
    for (i, &c) in chars.iter().enumerate() {
        if masked[i] {
            out.push('•');
        } else {
            out.push(c);
        }
    }
    out
}

/// The main tracker state
pub struct Tracker {
    pub db: Arc<Mutex<Connection>>,
    is_running: Arc<Mutex<bool>>,
    loop_active: Arc<Mutex<bool>>,
    current_window: Arc<Mutex<Option<windows_api::ActiveWindow>>>,
    input_monitor: Arc<InputMonitor>,
    track_titles: Arc<AtomicBool>,
    /// Cached settings (JSON values) read at runtime by the loop, cleanup
    /// thread and commands. Seeded from the DB at startup; updated via
    /// `set_settings`.
    settings: Arc<Mutex<HashMap<String, serde_json::Value>>>,
    /// Latest top-CPU processes sampled by the power thread
    /// (process name, cpu percent)
    cpu_snapshot: Arc<Mutex<Vec<(String, f32)>>>,
    /// When the last retention cleanup ran; kept on the Tracker (not per
    /// `start`) so frequent pause/resume can't keep postponing the 24h pass.
    last_cleanup: Arc<Mutex<std::time::Instant>>,
    /// Guards against stacking duplicate cleanup threads across pause/resume.
    cleanup_thread_active: Arc<Mutex<bool>>,
}

impl Tracker {
    /// Create a new tracker instance
    pub fn new(db: Connection) -> Self {
        let settings = Arc::new(Mutex::new(HashMap::new()));

        // Seed the settings cache from the database
        if let Ok(rows) = database::get_all_settings(&db) {
            if let Ok(mut map) = settings.lock() {
                for (key, value) in rows {
                    if let Ok(parsed) = serde_json::from_str(&value) {
                        map.insert(key, parsed);
                    }
                }
            }
        }

        Self {
            db: Arc::new(Mutex::new(db)),
            is_running: Arc::new(Mutex::new(false)),
            loop_active: Arc::new(Mutex::new(false)),
            current_window: Arc::new(Mutex::new(None)),
            input_monitor: Arc::new(InputMonitor::new()),
            track_titles: Arc::new(AtomicBool::new(true)),
            settings,
            cpu_snapshot: Arc::new(Mutex::new(Vec::new())),
            last_cleanup: Arc::new(Mutex::new(std::time::Instant::now())),
            cleanup_thread_active: Arc::new(Mutex::new(false)),
        }
    }

    /// Snapshot of the top-CPU processes (name, cpu %)
    pub fn get_cpu_snapshot(&self) -> Vec<(String, f32)> {
        self.cpu_snapshot.lock().unwrap().clone()
    }

    /// Start a lightweight thread that samples top-CPU processes every 5s
    /// (powers the Power page's live CPU view).
    pub fn start_power_sampling(&self) {
        let snapshot = self.cpu_snapshot.clone();
        std::thread::spawn(move || {
            let mut sys = sysinfo::System::new_all();
            loop {
                sys.refresh_processes(
                    sysinfo::ProcessesToUpdate::All,
                    true,
                );
                let mut top: Vec<(String, f32)> = sys
                    .processes()
                    .iter()
                    .filter_map(|(_, process)| {
                        let cpu = process.cpu_usage();
                        if cpu > 0.5 {
                            Some((process.name().to_string_lossy().to_string(), cpu))
                        } else {
                            None
                        }
                    })
                    .collect();
                top.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
                top.truncate(15);
                if let Ok(mut guard) = snapshot.lock() {
                    *guard = top;
                }
                std::thread::sleep(Duration::from_secs(5));
            }
        });
    }

    /// Apply a setting to the runtime cache (and any live flags it controls).
    pub fn apply_setting(&self, key: String, value: serde_json::Value) {
        if key == "track_window_titles" {
            if let Some(enabled) = value.as_bool() {
                self.track_titles.store(enabled, Ordering::Relaxed);
            }
        }
        if let Ok(mut map) = self.settings.lock() {
            map.insert(key, value);
        }
    }

    /// Snapshot of the settings cache (stored values only; the frontend
    /// merges defaults).
    pub fn get_settings_snapshot(&self) -> HashMap<String, serde_json::Value> {
        self.settings.lock().unwrap().clone()
    }

    /// Whether the tracking loop is currently running
    pub fn is_running(&self) -> bool {
        *self.is_running.lock().unwrap()
    }

    /// Start the tracking loop (called once on app start)
    pub fn start(&self, app: tauri::AppHandle) {
        let db = self.db.clone();
        let is_running = self.is_running.clone();
        let current_window = self.current_window.clone();
        let input_monitor = self.input_monitor.clone();
        let track_titles = self.track_titles.clone();
        let loop_active = self.loop_active.clone();
        let settings = self.settings.clone();
        let last_cleanup = self.last_cleanup.clone();
        let cleanup_active = self.cleanup_thread_active.clone();
        // Once-per-app-per-day dedupe for distraction-guard notifications
        let limit_notified = Arc::new(Mutex::new(HashSet::<String>::new()));

        // Re-assert the running flag so a still-alive loop keeps running
        // (resume semantics: Pause -> Resume must not spawn a duplicate loop).
        {
            let mut running = is_running.lock().unwrap();
            *running = true;
        }

        // Guard against spawning a second loop while one is still draining.
        {
            let mut active = loop_active.lock().unwrap();
            if *active {
                log::info!("Tracker loop is already active; nothing to start");
                return;
            }
            *active = true;
        }

        log::info!("Starting activity tracker...");

        // Drop any input counts accumulated while tracking was stopped
        input_monitor.reset();

        // Spawn the tracking loop
        std::thread::spawn(move || {
            let mut current_process: Option<String> = None;
            let mut current_title: Option<String> = None;
            let mut app_start_time = std::time::Instant::now();
            
            // Gamification accumulators
            let mut xp_seconds_accumulator = 0;
            let mut last_streak_check = String::new(); // Date string

            // Achievement evaluation state
            let mut consecutive_active_seconds: u32 = 0;
            let mut last_achievement_day = String::new();
            let mut early_bird_checked = false;
            let mut night_owl_checked = false;

            // Distraction guard: check daily app limits once per minute
            let mut last_limit_check = std::time::Instant::now();
            // Day the tray icon was last reset (amber limit state is per-day)
            let mut tray_reset_day = String::new();

            // Cleanup scheduling - run in a separate thread so it never blocks
            // the per-second loop. The 24h timer lives on the Tracker (not per
            // start) and a guard stops quick pause/resume cycles from stacking
            // duplicate cleanup threads or resetting the retention clock.
            let cleanup_db = db.clone();
            let cleanup_running = is_running.clone();
            let cleanup_settings = settings.clone();
            let cleanup_last = last_cleanup.clone();

            {
                let mut active = cleanup_active.lock().unwrap();
                if *active {
                    log::info!("Cleanup thread is already running; nothing to start");
                } else {
                    *active = true;
                    let cleanup_guard = cleanup_active.clone();
                    std::thread::spawn(move || {
                        const CLEANUP_INTERVAL: Duration = Duration::from_secs(86400);
                        
                        loop {
                            std::thread::sleep(Duration::from_secs(60)); // Check every minute
                            
                            let should_run = {
                                let running = cleanup_running.lock().unwrap();
                                if !*running { break; }
                                
                                let last = cleanup_last.lock().unwrap();
                                last.elapsed() >= CLEANUP_INTERVAL
                            };
                            
                            if should_run {
                                log::info!("Background cleanup: Starting database maintenance...");

                                // Retention is user-configurable (default 90 days);
                                // 0 means "keep forever" (skip cleanup entirely).
                                let retention_days = cleanup_settings
                                    .lock()
                                    .unwrap()
                                    .get("retention_days")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(90) as u32;

                                if retention_days == 0 {
                                    log::info!("Background cleanup: retention set to forever, skipping");
                                } else if let Ok(conn) = cleanup_db.lock() {
                                    if let Err(e) = database::cleanup_old_snapshots(&conn, retention_days) {
                                        log::error!("Background cleanup: Error cleaning snapshots: {}", e);
                                    }
                                    if let Err(e) = database::cleanup_old_input_activity(&conn, retention_days) {
                                        log::error!("Background cleanup: Error cleaning input: {}", e);
                                    }
                                    if let Err(e) = database::cleanup_old_window_events(&conn, retention_days) {
                                        log::error!("Background cleanup: Error cleaning events: {}", e);
                                    }
                                    // Note: no VACUUM here - it holds the DB write lock and would
                                    // stall the per-second tracking inserts. Freed pages are reused.
                                    log::info!("Background cleanup: Completed successfully");
                                }
                                
                                let mut last = cleanup_last.lock().unwrap();
                                *last = std::time::Instant::now();
                            }
                        }
                        log::info!("Background cleanup thread stopped");
                        *cleanup_guard.lock().unwrap() = false;
                    });
                }
            }

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

                // Runtime settings (cheap cache, updated via set_settings)
                let (idle_threshold, blacklist, redact_keywords) = {
                    let guard = settings.lock().unwrap();
                    let threshold = guard
                        .get("idle_threshold")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(60) as u32;
                    let blacklist: Vec<String> = guard
                        .get("blacklisted_apps")
                        .and_then(|v| serde_json::from_value(v.clone()).ok())
                        .unwrap_or_default();
                    let keywords: Vec<String> = guard
                        .get("redacted_keywords")
                        .and_then(|v| serde_json::from_value(v.clone()).ok())
                        .unwrap_or_default();
                    (threshold, blacklist, keywords)
                };

                let is_idle = idle_seconds > idle_threshold;
                let timestamp = windows_api::get_timestamp();
                let today = windows_api::get_today();

                // Get active window
                let active_window = windows_api::get_active_window();

                // Update current window for frontend queries (title redacted)
                {
                    let mut cw = current_window.lock().unwrap();
                    let mut window_for_state = active_window.clone();
                    if let Some(w) = window_for_state.as_mut() {
                        w.window_title = redact_title(&w.window_title, &redact_keywords);
                    }
                    *cw = window_for_state;
                }

                // Get input counts since last tick
                let input_counts = input_monitor.get_and_reset();

                // Reset contiguous-active counter once the user goes idle
                if is_idle {
                    consecutive_active_seconds = 0;
                }

                    // Record activity and app usage every second
                    if let Ok(conn) = db.lock() {
                        if let Err(e) = database::insert_activity_snapshot(&conn, &timestamp, is_idle, idle_seconds) {
                            log::error!("Failed to insert activity snapshot: {}", e);
                        }

                        // Record input activity if any
                        if input_counts.keystrokes > 0 || input_counts.mouse_clicks > 0 {
                            log::info!("Tracker: Recording input - Keys: {}, Clicks: {}", input_counts.keystrokes, input_counts.mouse_clicks);
                            if let Err(e) = database::insert_input_activity(
                                &conn, 
                                &timestamp, 
                                input_counts.keystrokes, 
                                input_counts.mouse_clicks, 
                                input_counts.mouse_distance
                            ) {
                                log::error!("Failed to insert input activity: {}", e);
                            }
                        }

                        // Track current app usage (1 second per tick)
                        if !is_idle {
                            if let Some(ref window) = active_window {
                                // Blacklisted apps are not recorded (privacy / noise)
                                let is_blacklisted = blacklist.iter().any(|b| {
                                    !b.is_empty()
                                        && window.process_name.to_lowercase().contains(&b.to_lowercase())
                                });

                                if !is_blacklisted {
                                // Always record 1 second of usage for current app
                                if let Err(e) = database::upsert_app_usage(&conn, &today, &window.process_name, 1) {
                                    log::error!("Failed to upsert app usage: {}", e);
                                }
                                
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
                                            // The stored timestamp is the event START (now minus the
                                            // previous window's duration); the frontend treats each
                                            // event as covering [timestamp, timestamp + duration].
                                            let start_iso = (chrono::Utc::now() - chrono::Duration::seconds(duration as i64))
                                                .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
                                            
                                            if let Err(e) = database::insert_window_event(
                                                &conn, 
                                                &start_iso,
                                                prev_process,
                                                prev_title,
                                                duration
                                            ) {
                                                log::error!("Failed to insert window event: {}", e);
                                            }
                                        }
                                    }

                                    log::info!("Window changed to: {}", window.process_name);
                                    current_process = Some(window.process_name.clone());
                                    let title = if track_titles.load(Ordering::Relaxed) {
                                        redact_title(&window.window_title, &redact_keywords)
                                    } else {
                                        String::new()
                                    };
                                    current_title = Some(title);
                                    app_start_time = std::time::Instant::now();
                                } else {
                                    // Update current title if changed
                                    let title = if track_titles.load(Ordering::Relaxed) {
                                        redact_title(&window.window_title, &redact_keywords)
                                    } else {
                                        String::new()
                                    };
                                    if let Some(ref current) = current_title {
                                        if current != &title {
                                            current_title = Some(title.clone());
                                        }
                                    } else {
                                        current_title = Some(title);
                                    }
                                }
                                } // end: !is_blacklisted
                            }
                        
                            // Achievement evaluation (daily + session based)
                            if today != last_achievement_day {
                                last_achievement_day = today.clone();
                                early_bird_checked = false;
                                night_owl_checked = false;
                            }

                            // Early Bird: active before 7 AM local time
                            if !early_bird_checked && chrono::Local::now().hour() < 7 {
                                if let Ok(unlocked) = database::unlock_achievement_with_reward(&conn, "early_bird", &timestamp, 50) {
                                    if unlocked {
                                        notify_achievement(&app, "Early Bird", 50);
                                    }
                                }
                                early_bird_checked = true;
                            }

                            // Night Owl: active after 10 PM local time
                            if !night_owl_checked && chrono::Local::now().hour() >= 22 {
                                if let Ok(unlocked) = database::unlock_achievement_with_reward(&conn, "night_owl", &timestamp, 50) {
                                    if unlocked {
                                        notify_achievement(&app, "Night Owl", 50);
                                    }
                                }
                                night_owl_checked = true;
                            }

                            // Deep Diver: 4 hours of contiguous focus
                            consecutive_active_seconds += 1;
                            if consecutive_active_seconds >= 4 * 3600 {
                                if let Ok(unlocked) = database::unlock_achievement_with_reward(&conn, "deep_diver", &timestamp, 100) {
                                    if unlocked {
                                        notify_achievement(&app, "Deep Diver", 100);
                                    }
                                }
                                consecutive_active_seconds = 0;
                            }

                            // Gamification Logic: XP & Leveling
                            xp_seconds_accumulator += 1;
                            if xp_seconds_accumulator >= 60 {
                                // Award 10 XP per minute of active time
                                if let Err(e) = database::add_xp(&conn, 10) {
                                    log::error!("Failed to add XP: {}", e);
                                }
                                xp_seconds_accumulator = 0;

                                // Check level up
                                if let Ok(stats) = database::get_user_stats(&conn) {
                                    let calculated_level = ((stats.total_xp as f64 / 100.0).sqrt().floor() as u32) + 1;
                                    if calculated_level > stats.current_level {
                                        if let Err(e) = database::update_level(&conn, calculated_level) {
                                            log::error!("Failed to update level: {}", e);
                                        } else {
                                            log::info!("Level Up! New Level: {}", calculated_level);
                                        }
                                    }
                                }
                            }

                            // Gamification Logic: Streak
                            if today != last_streak_check {
                                if let Err(e) = database::update_streak(&conn, &today) {
                                    log::error!("Failed to update streak: {}", e);
                                }
                                last_streak_check = today.clone();

                                // Consistency King: maintain a 7-day streak
                                if let Ok(stats) = database::get_user_stats(&conn) {
                                    if stats.current_streak >= 7 {
                                        if let Ok(unlocked) = database::unlock_achievement_with_reward(&conn, "consistency_king", &timestamp, 200) {
                                            if unlocked {
                                                notify_achievement(&app, "Consistency King", 200);
                                            }
                                        }
                                    }
                                    // Streak milestones: 7 / 30 / 100 days
                                    if stats.current_streak == 7 || stats.current_streak == 30 || stats.current_streak == 100 {
                                        notify_streak_milestone(&app, stats.current_streak);
                                    }

                                    // Streak achievements
                                    if stats.current_streak >= 30 {
                                        if let Ok(unlocked) = database::unlock_achievement_with_reward(&conn, "streak_30", &timestamp, 500) {
                                            if unlocked {
                                                notify_achievement(&app, "Month Marathon", 500);
                                            }
                                        }
                                    }
                                    if stats.current_streak >= 100 {
                                        if let Ok(unlocked) = database::unlock_achievement_with_reward(&conn, "streak_100", &timestamp, 2000) {
                                            if unlocked {
                                                notify_achievement(&app, "Century Club", 2000);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Distraction guard: check daily app limits once per minute
                    if last_limit_check.elapsed().as_secs() >= 60 {
                        if let Ok(guard_conn) = db.lock() {
                            check_app_limits(&guard_conn, &today, &settings, &app, &limit_notified);
                        }
                        last_limit_check = std::time::Instant::now();
                    }

                    // Reset the tray icon to the default at the start of each day
                    // (the amber limit state applies per-day)
                    if tray_reset_day != today {
                        tray_reset_day = today.clone();
                        if let Some(tray) = app.tray_by_id("main") {
                            let _ = tray.set_icon(app.default_window_icon().cloned());
                        }
                    }

                // Sleep for 1 second
                std::thread::sleep(Duration::from_secs(1));
            }
            *loop_active.lock().unwrap() = false;
            log::info!("Tracker loop thread exited");
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

    /// Get daily stats for today (from local midnight to now)
    pub fn get_today_stats(&self) -> Option<database::DailyStats> {
        // Calculate UTC boundaries for local "today"
        let local_start = chrono::Local::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
        let local_end = chrono::Local::now().date_naive().and_hms_opt(23, 59, 59).unwrap();
        
        let start_utc = chrono::Local.from_local_datetime(&local_start).unwrap().with_timezone(&chrono::Utc);
        let end_utc = chrono::Local.from_local_datetime(&local_end).unwrap().with_timezone(&chrono::Utc);

        let start_iso = start_utc.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let end_iso = end_utc.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);

        if let Ok(conn) = self.db.lock() {
            database::get_daily_stats(&conn, &start_iso, &end_iso).unwrap_or(None)
        } else {
            None
        }
    }
    
    /// Get activity timeline for today (from local midnight to now)
    pub fn get_today_timeline(&self) -> Vec<database::TimelineSegment> {
        let local_start = chrono::Local::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
        let local_end = chrono::Local::now().date_naive().and_hms_opt(23, 59, 59).unwrap();
        
        let start_utc = chrono::Local.from_local_datetime(&local_start).unwrap().with_timezone(&chrono::Utc);
        let end_utc = chrono::Local.from_local_datetime(&local_end).unwrap().with_timezone(&chrono::Utc);

        let start_iso = start_utc.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let end_iso = end_utc.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);

        if let Ok(conn) = self.db.lock() {
            database::get_activity_timeline(&conn, &start_iso, &end_iso).unwrap_or_default()
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

    /// Get input history in range
    pub fn get_input_history_range(&self, start_iso: &str, end_iso: &str) -> Vec<database::InputHistoryEntry> {
        if let Ok(conn) = self.db.lock() {
             database::get_input_history_range(&conn, start_iso, end_iso).unwrap_or_default()
        } else {
            Vec::new()
        }
    }
    
    /// Get window events for process in range
    pub fn get_events_for_process_range(&self, process_name: &str, start: &str, end: &str) -> Vec<database::WindowEvent> {
         if let Ok(conn) = self.db.lock() {
             database::get_window_events_for_process_in_range(&conn, process_name, start, end).unwrap_or_default()
         } else {
             Vec::new()
         }
    }

    /// Get window events in range with pagination
    pub fn get_events_range_paginated(&self, start: &str, end: &str, limit: u32, offset: u32) -> Vec<database::WindowEvent> {
         if let Ok(conn) = self.db.lock() {
             database::get_window_events_in_range_paginated(&conn, start, end, limit, offset).unwrap_or_default()
         } else {
             Vec::new()
         }
    }

    /// Get app usage in range
    pub fn get_app_usage_range(&self, start: &str, end: &str) -> Vec<(String, u32)> {
         if let Ok(conn) = self.db.lock() {
             database::get_app_usage_in_range(&conn, start, end).unwrap_or_default()
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

    /// Get idle seconds
    pub fn get_idle_seconds(&self) -> u32 {
        windows_api::get_idle_seconds()
    }
    /// Get user gamification stats
    pub fn get_user_stats(&self) -> Option<database::UserStats> {
        if let Ok(conn) = self.db.lock() {
            database::get_user_stats(&conn).ok()
        } else {
            None
        }
    }

    /// Get unlocked achievements
    pub fn get_unlocked_achievements(&self) -> Vec<String> {
        if let Ok(conn) = self.db.lock() {
            database::get_unlocked_achievements(&conn).unwrap_or_default()
        } else {
            Vec::new()
        }
    }

}

