use rusqlite::{Connection, Result};
use std::path::PathBuf;

/// Initialize the SQLite database with the activity tracking schema
pub fn init_database(app_data_dir: PathBuf) -> Result<Connection> {
    let db_path = app_data_dir.join("activity.db");
    let conn = Connection::open(&db_path)?;

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

        -- Aggregated daily stats
        CREATE TABLE IF NOT EXISTS daily_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            total_active_seconds INTEGER NOT NULL DEFAULT 0,
            total_idle_seconds INTEGER NOT NULL DEFAULT 0,
            total_keystrokes INTEGER NOT NULL DEFAULT 0,
            total_mouse_clicks INTEGER NOT NULL DEFAULT 0,
            total_mouse_distance INTEGER NOT NULL DEFAULT 0
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
        CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_stats(date);
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

/// Get daily stats
pub fn get_daily_stats(conn: &Connection, date: &str) -> Result<Option<DailyStats>> {
    let mut stmt = conn.prepare(
        "SELECT total_active_seconds, total_idle_seconds, total_keystrokes, 
                total_mouse_clicks, total_mouse_distance 
         FROM daily_stats WHERE date = ?1"
    )?;
    
    let result = stmt.query_row([date], |row| {
        Ok(DailyStats {
            total_active_seconds: row.get(0)?,
            total_idle_seconds: row.get(1)?,
            total_keystrokes: row.get(2)?,
            total_mouse_clicks: row.get(3)?,
            total_mouse_distance: row.get(4)?,
        })
    });
    
    match result {
        Ok(stats) => Ok(Some(stats)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

#[derive(Debug, serde::Serialize)]
pub struct DailyStats {
    pub total_active_seconds: u32,
    pub total_idle_seconds: u32,
    pub total_keystrokes: u32,
    pub total_mouse_clicks: u32,
    pub total_mouse_distance: u32,
}
