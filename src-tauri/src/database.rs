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
pub fn get_daily_stats(conn: &Connection, date: &str) -> Result<Option<DailyStats>> {
    // Get total active seconds from app usage (sum of all app usage for the day)
    let total_active: u32 = conn.query_row(
        "SELECT COALESCE(SUM(total_seconds), 0) FROM app_usage WHERE date = ?1",
        [date],
        |row| row.get(0),
    ).unwrap_or(0);

    let today_prefix = format!("{}%", date);
    
    // Get idle count from activity snapshots for today
    let idle_count: u32 = conn.query_row(
        "SELECT COUNT(*) FROM activity_snapshots WHERE timestamp LIKE ?1 AND is_idle = 1",
        [&today_prefix],
        |row| row.get(0),
    ).unwrap_or(0);
    
    // Get input totals
    let (total_keystrokes, total_mouse_clicks): (u32, u32) = conn.query_row(
        "SELECT COALESCE(SUM(keystrokes), 0), COALESCE(SUM(mouse_clicks), 0) 
         FROM input_activity WHERE timestamp LIKE ?1",
        [&today_prefix],
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

/// Get activity timeline grouped by hour for a specific date
pub fn get_activity_timeline(conn: &Connection, date: &str) -> Result<Vec<TimelineSegment>> {
    let today_prefix = format!("{}%", date);
    let mut stmt = conn.prepare(
        "SELECT substr(timestamp, 12, 2) || ':00' as hour,
                COUNT(CASE WHEN is_idle = 0 THEN 1 END) as active_secs,
                COUNT(CASE WHEN is_idle = 1 THEN 1 END) as idle_secs
         FROM activity_snapshots 
         WHERE timestamp LIKE ?1
         GROUP BY hour
         ORDER BY hour ASC"
    )?;
    
    let rows = stmt.query_map([&today_prefix], |row| {
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


/// Get raw input activity since a specific timestamp
pub fn get_input_history_since(conn: &Connection, since_iso: &str) -> Result<Vec<InputHistoryEntry>> {
    let mut stmt = conn.prepare(
        "SELECT timestamp, keystrokes, mouse_clicks 
         FROM input_activity 
         WHERE timestamp >= ?1 
         ORDER BY timestamp ASC"
    )?;
    
    let rows = stmt.query_map([since_iso], |row| {
        Ok(InputHistoryEntry {
            timestamp: row.get(0)?,
            keystrokes: row.get(1)?,
            mouse_clicks: row.get(2)?,
        })
    })?;
    
    rows.collect()
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
