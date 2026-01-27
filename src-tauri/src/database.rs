use rusqlite::{Connection, Result};
use std::path::PathBuf;

/// Initialize the SQLite database with the activity tracking schema
pub fn init_database(app_data_dir: PathBuf) -> Result<Connection> {
    let db_path = app_data_dir.join("activity.db");
    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for better concurrency
    conn.pragma_update(None, "journal_mode", "WAL")?;

    // Create tables for activity tracking
    conn.execute_batch(
        "
        -- Activity snapshots taken every second
        CREATE TABLE IF NOT EXISTS activity_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            is_idle INTEGER NOT NULL DEFAULT 0,
            idle_seconds INTEGER NOT NULL DEFAULT 0
        );

        -- Active window tracking
        CREATE TABLE IF NOT EXISTS window_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            process_name TEXT NOT NULL,
            window_title TEXT,
            duration_seconds INTEGER NOT NULL DEFAULT 0
        );

        -- Input activity (keyboard/mouse counts, not content)
        CREATE TABLE IF NOT EXISTS input_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            keystrokes INTEGER NOT NULL DEFAULT 0,
            mouse_clicks INTEGER NOT NULL DEFAULT 0,
            mouse_distance INTEGER NOT NULL DEFAULT 0
        );

        -- App usage aggregates
        CREATE TABLE IF NOT EXISTS app_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            process_name TEXT NOT NULL,
            total_seconds INTEGER NOT NULL DEFAULT 0,
            UNIQUE(date, process_name)
        );

        -- Create indexes for faster queries
        CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_snapshots(timestamp);
        CREATE INDEX IF NOT EXISTS idx_window_timestamp ON window_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_input_timestamp ON input_activity(timestamp);
        CREATE INDEX IF NOT EXISTS idx_app_usage_date ON app_usage(date);

        -- Gamification: User Stats
        CREATE TABLE IF NOT EXISTS user_stats (
            id INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton row
            total_xp INTEGER NOT NULL DEFAULT 0,
            current_level INTEGER NOT NULL DEFAULT 1,
            current_streak INTEGER NOT NULL DEFAULT 0,
            last_activity_date TEXT
        );
        INSERT OR IGNORE INTO user_stats (id, total_xp, current_level, current_streak) VALUES (1, 0, 1, 0);

        -- Gamification: Achievements
        CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            unlocked_at TEXT NOT NULL
        );
        "
    )?;

    log::info!("Database initialized at: {:?}", db_path);
    Ok(conn)
}

/// Insert an activity snapshot
pub fn insert_activity_snapshot(
    conn: &Connection,
    timestamp: &str,
    is_idle: bool,
    idle_seconds: u32,
) -> Result<()> {
    conn.execute(
        "INSERT INTO activity_snapshots (timestamp, is_idle, idle_seconds) VALUES (?1, ?2, ?3)",
        (timestamp, is_idle as i32, idle_seconds),
    )?;
    Ok(())
}

/// Insert a window event
pub fn insert_window_event(
    conn: &Connection,
    timestamp: &str,
    process_name: &str,
    window_title: &str,
    duration_seconds: u32,
) -> Result<()> {
    conn.execute(
        "INSERT INTO window_events (timestamp, process_name, window_title, duration_seconds) 
         VALUES (?1, ?2, ?3, ?4)",
        (timestamp, process_name, window_title, duration_seconds),
    )?;
    Ok(())
}

/// Insert input activity
pub fn insert_input_activity(
    conn: &Connection,
    timestamp: &str,
    keystrokes: u32,
    mouse_clicks: u32,
    mouse_distance: u32,
) -> Result<()> {
    conn.execute(
        "INSERT INTO input_activity (timestamp, keystrokes, mouse_clicks, mouse_distance) 
         VALUES (?1, ?2, ?3, ?4)",
        (timestamp, keystrokes, mouse_clicks, mouse_distance),
    )?;
    Ok(())
}

/// Insert or update app usage for today
pub fn upsert_app_usage(conn: &Connection, date: &str, process_name: &str, seconds: u32) -> Result<()> {
    conn.execute(
        "INSERT INTO app_usage (date, process_name, total_seconds)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(date, process_name) DO UPDATE SET
         total_seconds = total_seconds + ?3",
        (date, process_name, seconds),
    )?;
    Ok(())
}

/// Get app usage for a specific date
pub fn get_app_usage(conn: &Connection, date: &str) -> Result<Vec<(String, u32)>> {
    let mut stmt = conn.prepare(
        "SELECT process_name, total_seconds FROM app_usage WHERE date = ?1 ORDER BY total_seconds DESC"
    )?;
    
    let rows = stmt.query_map([date], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?))
    })?;
    
    rows.collect()
}

/// Get daily stats computed from app_usage table
/// Get daily stats computed from app_usage, snapshots and input tables
pub fn get_daily_stats(
    conn: &Connection, 
    date: &str, // Local date for app_usage (YYYY-MM-DD)
    start_timestamp: &str, // UTC start (ISO 8601)
    end_timestamp: &str    // UTC end (ISO 8601)
) -> Result<Option<DailyStats>> {
    // Get total active seconds from app usage (sum of all app usage for the local day)
    let total_active: u32 = conn.query_row(
        "SELECT COALESCE(SUM(total_seconds), 0) FROM app_usage WHERE date = ?1",
        [date],
        |row| row.get(0),
    ).unwrap_or(0);

    // Get idle count from activity snapshots for the UTC range
    let idle_count: u32 = conn.query_row(
        "SELECT COUNT(*) FROM activity_snapshots WHERE timestamp >= ?1 AND timestamp <= ?2 AND is_idle = 1",
        [start_timestamp, end_timestamp],
        |row| row.get(0),
    ).unwrap_or(0);
    
    // Get input totals for the UTC range
    let (total_keystrokes, total_mouse_clicks): (u32, u32) = conn.query_row(
        "SELECT COALESCE(SUM(keystrokes), 0), COALESCE(SUM(mouse_clicks), 0) 
         FROM input_activity WHERE timestamp >= ?1 AND timestamp <= ?2",
        [start_timestamp, end_timestamp],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|e| {
        log::error!("Error getting input stats: {:?}", e);
        e
    }).unwrap_or((0, 0));

    // If no data yet, return None
    if total_active == 0 && idle_count == 0 && total_keystrokes == 0 {
        return Ok(None);
    }

    Ok(Some(DailyStats {
        total_active_seconds: total_active,
        total_idle_seconds: idle_count,
        total_keystrokes,
        total_mouse_clicks,
        total_mouse_distance: 0,
    }))
}

/// Get stats for a specific UTC range (keystrokes, clicks, active time from snapshots)
pub fn get_stats_range(
    conn: &Connection,
    start_timestamp: &str,
    end_timestamp: &str
) -> Result<DailyStats> {
    // Active/Idle from snapshots
    let active_count: u32 = conn.query_row(
        "SELECT COUNT(*) FROM activity_snapshots WHERE timestamp >= ?1 AND timestamp <= ?2 AND is_idle = 0",
        [start_timestamp, end_timestamp],
        |row| row.get(0)
    ).unwrap_or(0);

    let idle_count: u32 = conn.query_row(
        "SELECT COUNT(*) FROM activity_snapshots WHERE timestamp >= ?1 AND timestamp <= ?2 AND is_idle = 1",
        [start_timestamp, end_timestamp],
        |row| row.get(0)
    ).unwrap_or(0);

    // Inputs from input_activity
    let (total_keystrokes, total_mouse_clicks): (u32, u32) = conn.query_row(
        "SELECT COALESCE(SUM(keystrokes), 0), COALESCE(SUM(mouse_clicks), 0) 
         FROM input_activity WHERE timestamp >= ?1 AND timestamp <= ?2",
        [start_timestamp, end_timestamp],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).unwrap_or((0, 0));

    Ok(DailyStats {
        total_active_seconds: active_count,
        total_idle_seconds: idle_count,
        total_keystrokes,
        total_mouse_clicks,
        total_mouse_distance: 0,
    })
}

/// Get activity timeline grouped by hour for a specific date
/// Get activity timeline grouped by hour for a specific range
pub fn get_activity_timeline(
    conn: &Connection, 
    start_timestamp: &str, 
    end_timestamp: &str
) -> Result<Vec<TimelineSegment>> {
    // subtsr(timestamp, 12, 2) works for "YYYY-MM-DDTHH:MM:SS"
    let mut stmt = conn.prepare(
        "SELECT substr(timestamp, 12, 2) || ':00' as hour,
                COUNT(CASE WHEN is_idle = 0 THEN 1 END) as active_secs,
                COUNT(CASE WHEN is_idle = 1 THEN 1 END) as idle_secs
         FROM activity_snapshots 
         WHERE timestamp >= ?1 AND timestamp <= ?2
         GROUP BY hour
         ORDER BY hour ASC"
    )?;
    
    let rows = stmt.query_map([start_timestamp, end_timestamp], |row| {
        Ok(TimelineSegment {
            time: row.get(0)?,
            active_seconds: row.get(1)?,
            idle_seconds: row.get(2)?,
        })
    })?;
    
    rows.collect()
}

/// Get recent window events (limit 50) - Deprecated-ish in favor of range
pub fn get_recent_window_events(conn: &Connection) -> Result<Vec<WindowEvent>> {
    let mut stmt = conn.prepare(
        "SELECT timestamp, process_name, window_title, duration_seconds 
         FROM window_events 
         ORDER BY id DESC LIMIT 50"
    )?;
    
    let rows = stmt.query_map([], |row| {
        Ok(WindowEvent {
            timestamp: row.get(0)?,
            process_name: row.get(1)?,
            window_title: row.get(2)?,
            duration_seconds: row.get(3)?,
        })
    })?;
    
    rows.collect()
}

/// Get window events in range
pub fn get_window_events_in_range(conn: &Connection, start_iso: &str, end_iso: &str) -> Result<Vec<WindowEvent>> {
    let mut stmt = conn.prepare(
        "SELECT timestamp, process_name, window_title, duration_seconds 
         FROM window_events 
         WHERE timestamp >= ?1 AND timestamp <= ?2
         ORDER BY timestamp DESC"
    )?;
    
    let rows = stmt.query_map([start_iso, end_iso], |row| {
        Ok(WindowEvent {
            timestamp: row.get(0)?,
            process_name: row.get(1)?,
            window_title: row.get(2)?,
            duration_seconds: row.get(3)?,
        })
    })?;
    
    rows.collect()
}

/// Get window events in range with pagination
pub fn get_window_events_in_range_paginated(
    conn: &Connection, 
    start_time: &str, 
    end_time: &str, 
    limit: u32, 
    offset: u32
) -> Result<Vec<WindowEvent>> {
    let mut stmt = conn.prepare(
        "SELECT timestamp, process_name, window_title, duration_seconds 
         FROM window_events 
         WHERE timestamp >= ?1 AND timestamp <= ?2 
         ORDER BY timestamp DESC
         LIMIT ?3 OFFSET ?4"
    )?;
    
    let rows = stmt.query_map(rusqlite::params![start_time, end_time, limit, offset], |row| {
        Ok(WindowEvent {
            timestamp: row.get(0)?,
            process_name: row.get(1)?,
            window_title: row.get(2)?,
            duration_seconds: row.get(3)?,
        })
    })?;

    let mut events = Vec::new();
    for row in rows {
        events.push(row?);
    }
    Ok(events)
}

/// Get window events for a specific process in range
pub fn get_window_events_for_process_in_range(
    conn: &Connection, 
    process_name: &str, 
    start_iso: &str, 
    end_iso: &str
) -> Result<Vec<WindowEvent>> {
    let mut stmt = conn.prepare(
        "SELECT timestamp, process_name, window_title, duration_seconds 
         FROM window_events 
         WHERE process_name = ?1 AND timestamp >= ?2 AND timestamp <= ?3
         ORDER BY timestamp DESC"
    )?;
    
    let rows = stmt.query_map([process_name, start_iso, end_iso], |row| {
        Ok(WindowEvent {
            timestamp: row.get(0)?,
            process_name: row.get(1)?,
            window_title: row.get(2)?,
            duration_seconds: row.get(3)?,
        })
    })?;
    
    rows.collect()
}

/// Get app usage aggregated in range
pub fn get_app_usage_in_range(conn: &Connection, start_date: &str, end_date: &str) -> Result<Vec<(String, u32)>> {
    let mut stmt = conn.prepare(
        "SELECT process_name, SUM(total_seconds) as total
         FROM app_usage 
         WHERE date >= ?1 AND date <= ?2
         GROUP BY process_name
         ORDER BY total DESC"
    )?;
    
    let rows = stmt.query_map([start_date, end_date], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?))
    })?;
    
    rows.collect()
}


/// Get raw input activity in a specific range
pub fn get_input_history_range(conn: &Connection, start_iso: &str, end_iso: &str) -> Result<Vec<InputHistoryEntry>> {
    let mut stmt = conn.prepare(
        "SELECT timestamp, keystrokes, mouse_clicks 
         FROM input_activity 
         WHERE timestamp >= ?1 AND timestamp <= ?2
         ORDER BY timestamp ASC"
    )?;
    
    let rows = stmt.query_map([start_iso, end_iso], |row| {
        Ok(InputHistoryEntry {
            timestamp: row.get(0)?,
            keystrokes: row.get(1)?,
            mouse_clicks: row.get(2)?,
        })
    })?;
    
    rows.collect()
}

/// Get current user stats
pub fn get_user_stats(conn: &Connection) -> Result<UserStats> {
    let mut stmt = conn.prepare("SELECT total_xp, current_level, current_streak, last_activity_date FROM user_stats WHERE id = 1")?;
    
    let stats = stmt.query_row([], |row| {
        Ok(UserStats {
            total_xp: row.get(0)?,
            current_level: row.get(1)?,
            current_streak: row.get(2)?,
            last_activity_date: row.get(3)?,
        })
    })?;
    
    Ok(stats)
}

/// Add XP to the user
pub fn add_xp(conn: &Connection, amount: u32) -> Result<()> {
    conn.execute(
        "UPDATE user_stats SET total_xp = total_xp + ?1",
        [amount],
    )?;
    Ok(())
}

/// Update user level
pub fn update_level(conn: &Connection, new_level: u32) -> Result<()> {
    conn.execute(
        "UPDATE user_stats SET current_level = ?1",
        [new_level],
    )?;
    Ok(())
}

/// Helper to update streak based on activity date
pub fn update_streak(conn: &Connection, today: &str) -> Result<()> {
    let current_stats = get_user_stats(conn)?;
    let mut new_streak = current_stats.current_streak;
    
    if let Some(last_date) = current_stats.last_activity_date {
        if last_date == today {
            return Ok(()); // Already active today
        }
        
        // Parse dates to check continuity
        let last_dt = chrono::NaiveDate::parse_from_str(&last_date, "%Y-%m-%d").unwrap_or_else(|_| {
            chrono::NaiveDate::from_ymd_opt(2000, 1, 1).unwrap()
        });
        let today_dt = chrono::NaiveDate::parse_from_str(today, "%Y-%m-%d").unwrap_or_else(|_| {
             chrono::NaiveDate::from_ymd_opt(2000, 1, 1).unwrap()
        });
        
        // If today is exactly the day after last activity
        if today_dt == last_dt.succ_opt().unwrap_or(last_dt) {
            new_streak += 1;
            log::info!("Streak continued! New streak: {}", new_streak);
        } else {
            new_streak = 1; // Streak broken, reset to 1
            log::info!("Streak broken. Resetting to 1.");
        }
    } else {
        new_streak = 1; // First activity ever
    }
    
    conn.execute(
        "UPDATE user_stats SET current_streak = ?1, last_activity_date = ?2",
        (new_streak, today),
    )?;
    
    Ok(())
}

/// Unlock an achievement
pub fn unlock_achievement(conn: &Connection, code: &str, timestamp: &str) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO achievements (code, unlocked_at) VALUES (?1, ?2)",
        (code, timestamp),
    )?;
    Ok(())
}

/// Get all unlocked achievements
pub fn get_unlocked_achievements(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT code FROM achievements")?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    rows.collect()
}

/// Delete old activity snapshots beyond retention period
pub fn cleanup_old_snapshots(conn: &Connection, retention_days: u32) -> Result<usize> {
    let cutoff_date = chrono::Utc::now() - chrono::Duration::days(retention_days as i64);
    let cutoff = cutoff_date.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    
    conn.execute(
        "DELETE FROM activity_snapshots WHERE timestamp < ?1",
        [&cutoff],
    )
}

/// Delete old input activity
pub fn cleanup_old_input_activity(conn: &Connection, retention_days: u32) -> Result<usize> {
    let cutoff_date = chrono::Utc::now() - chrono::Duration::days(retention_days as i64);
    let cutoff = cutoff_date.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    
    conn.execute(
        "DELETE FROM input_activity WHERE timestamp < ?1",
        [&cutoff],
    )
}

/// Delete old window events
pub fn cleanup_old_window_events(conn: &Connection, retention_days: u32) -> Result<usize> {
    let cutoff_date = chrono::Utc::now() - chrono::Duration::days(retention_days as i64);
    let cutoff = cutoff_date.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    
    conn.execute(
        "DELETE FROM window_events WHERE timestamp < ?1",
        [&cutoff],
    )
}

/// Run vacuum to reclaim disk space
pub fn vacuum_database(conn: &Connection) -> Result<()> {
    conn.execute("VACUUM", [])?;
    Ok(())
}

/// Clear all data from the database
pub fn clear_database(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "DELETE FROM activity_snapshots;
         DELETE FROM window_events;
         DELETE FROM app_usage;
         DELETE FROM input_activity;
         VACUUM;"
    )?;
    Ok(())
}

#[derive(Debug, serde::Serialize)]
pub struct DailyStats {
    pub total_active_seconds: u32,
    pub total_idle_seconds: u32,
    pub total_keystrokes: u32,
    pub total_mouse_clicks: u32,
    pub total_mouse_distance: u32,
}

#[derive(Debug, serde::Serialize)]
pub struct TimelineSegment {
    pub time: String, // HH:MM
    pub active_seconds: u32,
    pub idle_seconds: u32,
}

#[derive(Debug, serde::Serialize)]
pub struct WindowEvent {
    pub timestamp: String,
    pub process_name: String,
    pub window_title: Option<String>,
    pub duration_seconds: u32,
}

#[derive(Debug, serde::Serialize)]
pub struct InputHistoryEntry {
    pub timestamp: String,
    pub keystrokes: u32,
    pub mouse_clicks: u32,
}

#[derive(Debug, serde::Serialize)]
pub struct UserStats {
    pub total_xp: u32,
    pub current_level: u32,
    pub current_streak: u32,
    pub last_activity_date: Option<String>,
}
