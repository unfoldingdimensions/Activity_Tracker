use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::collections::HashMap;
use chrono::{Timelike, TimeZone};

/// Initialize the SQLite database with the activity tracking schema
pub fn init_database(app_data_dir: PathBuf) -> Result<Connection> {
    let db_path = app_data_dir.join("activity.db");
    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for better concurrency
    conn.pragma_update(None, "journal_mode", "WAL")?;

    init_schema(&conn)?;

    // `achievements` used AUTOINCREMENT, which burned an id on every duplicate that
    // `INSERT OR IGNORE` refused — 289 attempts, 5 rows, ids 1/4/10/60/117 (P2-6, D-031).
    match drop_achievement_autoincrement(&conn) {
        Ok(true) => log::info!("Rebuilt achievements without AUTOINCREMENT (ids preserved)"),
        Ok(false) => {}
        Err(e) => log::error!("Rebuilding achievements failed: {}", e),
    }

    log::info!("Database initialized at: {:?}", db_path);
    Ok(conn)
}

/// Rebuild `achievements` without `AUTOINCREMENT`, preserving the ids it already has.
///
/// An `id` here was never an identity — `code` is, and it is `UNIQUE`. The `AUTOINCREMENT`
/// keyword only added a global counter that `INSERT OR IGNORE` advances *before* it discovers
/// the duplicate, so refused achievements left gaps: measured 5 rows carrying ids 1, 4, 10,
/// 60 and 117 after 289 attempts. Without the keyword the rowid is assigned only when a row
/// is actually inserted, so a refused duplicate costs nothing (P2-6, D-031).
///
/// SQLite cannot drop the keyword in place, so the table is rebuilt; the rows are copied by
/// explicit id, so any reference to an existing achievement still resolves.
pub fn drop_achievement_autoincrement(conn: &Connection) -> Result<bool> {
    let ddl: String = conn.query_row(
        "SELECT COALESCE(sql, '') FROM sqlite_master WHERE type = 'table' AND name = 'achievements'",
        [],
        |row| row.get(0),
    )?;
    if !ddl.to_uppercase().contains("AUTOINCREMENT") {
        return Ok(false);
    }

    {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(
            "CREATE TABLE achievements_rebuilt (
                 id INTEGER PRIMARY KEY,
                 code TEXT NOT NULL UNIQUE,
                 unlocked_at TEXT NOT NULL
             );
             INSERT INTO achievements_rebuilt (id, code, unlocked_at)
                 SELECT id, code, unlocked_at FROM achievements;
             DROP TABLE achievements;
             ALTER TABLE achievements_rebuilt RENAME TO achievements;",
        )?;
        tx.commit()?;
    }
    Ok(true)
}

/// Create every table, index and column on an open connection (idempotent).
///
/// Split out of [`init_database`] so tests can apply the real schema to an
/// in-memory database instead of restating it — a restated schema is the copy that
/// silently drifts.
pub fn init_schema(conn: &Connection) -> Result<()> {
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
        -- duration_seconds: wall-clock span of the event (first tick -> last tick)
        -- active_seconds:   seconds inside that span where the machine was NOT idle
        --                   (NULL on rows recorded before the column existed; the
        --                   startup backfill derives them from activity_snapshots)
        CREATE TABLE IF NOT EXISTS window_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            process_name TEXT NOT NULL,
            window_title TEXT,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            active_seconds INTEGER
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
            id INTEGER PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            unlocked_at TEXT NOT NULL
        );

        -- Key-value settings store (JSON values, machine-wide)
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        "
    )?;

    // Migration (2026-10-31, D-018): `active_seconds` on window_events. Added
    // separately from CREATE TABLE so existing databases pick it up; rows recorded
    // before this point keep NULL and are filled by
    // `backfill_window_event_active_seconds` once, at startup.
    let has_active_seconds: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('window_events') WHERE name = 'active_seconds'",
        [],
        |row| row.get(0),
    )?;
    if has_active_seconds == 0 {
        conn.execute("ALTER TABLE window_events ADD COLUMN active_seconds INTEGER", [])?;
        log::info!("Migrated window_events: added active_seconds");
    }

    Ok(())
}

/// Log a failed read and continue with a fallback value.
///
/// Reads deliberately degrade rather than blanking a surface (D-012), but a silent
/// zero is indistinguishable from an idle day. Now that release builds log (D-024),
/// every degraded read says so at `warn` — the behaviour stays, the silence does not.
pub fn degrade<T>(what: &str, result: Result<T>, fallback: T) -> T {
    match result {
        Ok(value) => value,
        Err(e) => {
            log::warn!(
                "Query failed [{}]: {} — reporting a default so the surface stays readable",
                what,
                e
            );
            fallback
        }
    }
}

/// Fill `active_seconds` for window events recorded before the column existed.
///
/// `duration_seconds` is the wall-clock span between an event's first and last
/// tick; `active_seconds` counts only the seconds inside that span where the
/// machine was not idle. The per-second `activity_snapshots` table still holds that
/// truth for every second since tracking began, so the correction is derived, not
/// estimated — an event over a 4-hour idle stretch ends up with its few real
/// minutes instead of 4 hours.
///
/// One statement: SQLite counts the non-idle snapshots inside each span using the
/// timestamp index. Measured ~9 s for 62k events, run once at startup before the
/// tracking loop starts, so it never stalls capture.
pub fn backfill_window_event_active_seconds(conn: &Connection) -> Result<usize> {
    // A failed count would silently skip the whole backfill, so this one propagates.
    let pending: i64 = conn.query_row(
        "SELECT COUNT(*) FROM window_events WHERE active_seconds IS NULL",
        [],
        |row| row.get(0),
    )?;
    if pending == 0 {
        return Ok(0);
    }

    log::info!("Backfilling active seconds for {} window events", pending);
    conn.execute(
        "UPDATE window_events
            SET active_seconds = (
                SELECT COUNT(*) FROM activity_snapshots s
                 WHERE s.is_idle = 0
                   AND s.timestamp >= window_events.timestamp
                   AND s.timestamp < strftime('%Y-%m-%dT%H:%M:%fZ',
                                              window_events.timestamp,
                                              '+' || duration_seconds || ' seconds')
            )
          WHERE active_seconds IS NULL",
        [],
    )
}

/// Collapse process names that differ only by case (D-021).
///
/// Windows reports the casing baked into the executable, so one app arrives as both
/// `Claude.exe` and `claude.exe` and its time splits across two rows — 36 of the 72
/// tracked days carried both, splitting 35.9 h. Identity is case-insensitive: rows
/// are stored lowercase and the UI restores a display name with `formatAppName`.
///
/// Three statements in one transaction, idempotent by construction: afterwards
/// `process_name <> lower(process_name)` matches nothing. Returns
/// `(app_usage rows folded away, window_events rows relabelled)`.
pub fn normalise_process_names(conn: &Connection) -> Result<(usize, usize)> {
    // Counted reads that gate a migration propagate: a silent 0 would skip the work.
    let pending: i64 = conn.query_row(
        "SELECT COUNT(*) FROM app_usage WHERE process_name <> lower(process_name)",
        [],
        |row| row.get(0),
    )?;

    let events_pending: i64 = conn.query_row(
        "SELECT COUNT(*) FROM window_events WHERE process_name <> lower(process_name)",
        [],
        |row| row.get(0),
    )?;

    if pending == 0 && events_pending == 0 {
        return Ok((0, 0));
    }

    log::info!(
        "Normalising process names: {} app_usage rows, {} window events",
        pending,
        events_pending
    );

    let tx = conn.unchecked_transaction()?;

    // Fold a differently-cased row into its lowercase twin (or create that twin),
    // then delete the original. `app_usage` has UNIQUE(date, process_name), so the
    // seconds have to be summed before the duplicate name disappears.
    tx.execute(
        "INSERT INTO app_usage (date, process_name, total_seconds)
         SELECT date, lower(process_name), SUM(total_seconds)
           FROM app_usage
          WHERE process_name <> lower(process_name)
          GROUP BY date, lower(process_name)
         ON CONFLICT(date, process_name) DO UPDATE
            SET total_seconds = total_seconds + excluded.total_seconds",
        [],
    )?;
    let folded = tx.execute(
        "DELETE FROM app_usage WHERE process_name <> lower(process_name)",
        [],
    )?;

    // Event rows carry no unique key, so they can simply be relabelled in place.
    let relabelled = tx.execute(
        "UPDATE window_events SET process_name = lower(process_name)
          WHERE process_name <> lower(process_name)",
        [],
    )?;

    tx.commit()?;
    Ok((folded, relabelled))
}

/// Read every stored app-usage row (date, process_name, total_seconds)
pub fn get_all_app_usage(conn: &Connection) -> Result<Vec<(String, String, u32)>> {
    let mut stmt = conn.prepare(crate::export::ALL_APP_USAGE_SQL)?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, u32>(2)?))
    })?;
    rows.collect()
}



/// Write a single setting value (JSON text)
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )?;
    Ok(())
}

/// Read every stored setting
pub fn get_all_settings(conn: &Connection) -> Result<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
    rows.collect()
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
    active_seconds: u32,
) -> Result<()> {
    conn.execute(
        "INSERT INTO window_events (timestamp, process_name, window_title, duration_seconds, active_seconds) 
         VALUES (?1, ?2, ?3, ?4, ?5)",
        (timestamp, process_name, window_title, duration_seconds, active_seconds),
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

/// Get daily stats computed from activity snapshots and input activity.
/// Active/idle seconds are per-second snapshot row counts over the UTC range —
/// the same definition `get_stats_range` uses — so the headline metric stays
/// consistent whether the frontend asks for "today" or a historical range.
pub fn get_daily_stats(
    conn: &Connection, 
    start_timestamp: &str, // UTC start (ISO 8601)
    end_timestamp: &str    // UTC end (ISO 8601)
) -> Result<Option<DailyStats>> {
    // Active/Idle seconds from per-second activity snapshots
    let total_active: u32 = degrade(
        "daily active seconds",
        conn.query_row(
            "SELECT COUNT(*) FROM activity_snapshots WHERE timestamp >= ?1 AND timestamp <= ?2 AND is_idle = 0",
            [start_timestamp, end_timestamp],
            |row| row.get(0),
        ),
        0,
    );

    // Get idle count from activity snapshots for the UTC range
    let idle_count: u32 = degrade(
        "daily idle seconds",
        conn.query_row(
            "SELECT COUNT(*) FROM activity_snapshots WHERE timestamp >= ?1 AND timestamp <= ?2 AND is_idle = 1",
            [start_timestamp, end_timestamp],
            |row| row.get(0),
        ),
        0,
    );
    
    // Get input totals for the UTC range
    let (total_keystrokes, total_mouse_clicks, total_mouse_distance): (u32, u32, u32) = degrade(
        "daily input totals",
        conn.query_row(
            "SELECT COALESCE(SUM(keystrokes), 0), COALESCE(SUM(mouse_clicks), 0), COALESCE(SUM(mouse_distance), 0) 
             FROM input_activity WHERE timestamp >= ?1 AND timestamp <= ?2",
            [start_timestamp, end_timestamp],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ),
        (0, 0, 0),
    );

    // If no data yet, return None
    if total_active == 0 && idle_count == 0 && total_keystrokes == 0 {
        return Ok(None);
    }

    Ok(Some(DailyStats {
        total_active_seconds: total_active,
        total_idle_seconds: idle_count,
        total_keystrokes,
        total_mouse_clicks,
        total_mouse_distance,
    }))
}

/// Get stats for a specific UTC range (keystrokes, clicks, active time from snapshots)
pub fn get_stats_range(
    conn: &Connection,
    start_timestamp: &str,
    end_timestamp: &str
) -> Result<DailyStats> {
    // Active/Idle from snapshots
    let active_count: u32 = degrade(
        "range active seconds",
        conn.query_row(
            "SELECT COUNT(*) FROM activity_snapshots WHERE timestamp >= ?1 AND timestamp <= ?2 AND is_idle = 0",
            [start_timestamp, end_timestamp],
            |row| row.get(0),
        ),
        0,
    );

    let idle_count: u32 = degrade(
        "range idle seconds",
        conn.query_row(
            "SELECT COUNT(*) FROM activity_snapshots WHERE timestamp >= ?1 AND timestamp <= ?2 AND is_idle = 1",
            [start_timestamp, end_timestamp],
            |row| row.get(0),
        ),
        0,
    );

    // Inputs from input_activity
    let (total_keystrokes, total_mouse_clicks, total_mouse_distance): (u32, u32, u32) = degrade(
        "range input totals",
        conn.query_row(
            "SELECT COALESCE(SUM(keystrokes), 0), COALESCE(SUM(mouse_clicks), 0), COALESCE(SUM(mouse_distance), 0) 
             FROM input_activity WHERE timestamp >= ?1 AND timestamp <= ?2",
            [start_timestamp, end_timestamp],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ),
        (0, 0, 0),
    );

    Ok(DailyStats {
        total_active_seconds: active_count,
        total_idle_seconds: idle_count,
        total_keystrokes,
        total_mouse_clicks,
        total_mouse_distance,
    })
}

/// Get activity timeline grouped by local hour for a specific range.
/// Timestamps are stored as UTC ISO-8601 strings; we group by the full
/// UTC hour in SQL, then re-bucket each UTC hour into the local hour so the
/// resulting "HH:00" labels match the machine's timezone (same convention as
/// `app_usage.date`).
///
/// Buckets are keyed by local HOUR ONLY (0-23), so the range must span a
/// single local day — the only caller (`get_today_timeline`) passes local
/// midnight -> 23:59:59. A multi-day range would collapse into one 24h cycle.
pub fn get_activity_timeline(
    conn: &Connection, 
    start_timestamp: &str, 
    end_timestamp: &str
) -> Result<Vec<TimelineSegment>> {
    // Hour label is "YYYY-MM-DDTHH:00" (UTC), parseable by chrono.
    let mut stmt = conn.prepare(
        "SELECT substr(timestamp, 1, 13) || ':00' as hour,
                COUNT(CASE WHEN is_idle = 0 THEN 1 END) as active_secs,
                COUNT(CASE WHEN is_idle = 1 THEN 1 END) as idle_secs
         FROM activity_snapshots 
         WHERE timestamp >= ?1 AND timestamp <= ?2
         GROUP BY hour
         ORDER BY hour ASC"
    )?;
    
    let rows = stmt.query_map([start_timestamp, end_timestamp], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, u32>(1)?,
            row.get::<_, u32>(2)?,
        ))
    })?;

    // Re-bucket UTC hours into local-hour buckets
    let mut buckets: HashMap<u32, (u32, u32)> = HashMap::new();
    for row in rows {
        let (hour_utc, active_secs, idle_secs) = row?;
        if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(&hour_utc, "%Y-%m-%dT%H:%M") {
            let utc_dt = chrono::Utc.from_utc_datetime(&naive);
            let local_hour = utc_dt.with_timezone(&chrono::Local).hour();
            let entry = buckets.entry(local_hour).or_insert((0, 0));
            entry.0 += active_secs;
            entry.1 += idle_secs;
        }
    }

    let mut segments: Vec<TimelineSegment> = buckets
        .into_iter()
        .map(|(hour, (active_secs, idle_secs))| TimelineSegment {
            time: format!("{:02}:00", hour),
            active_seconds: active_secs,
            idle_seconds: idle_secs,
        })
        .collect();
    segments.sort_by(|a, b| a.time.cmp(&b.time));

    Ok(segments)
}

/// Get recent window events (limit 500) - Deprecated-ish in favor of range
pub fn get_recent_window_events(conn: &Connection) -> Result<Vec<WindowEvent>> {
    let mut stmt = conn.prepare(
        "SELECT timestamp, process_name, window_title, duration_seconds, active_seconds 
         FROM window_events 
         ORDER BY id DESC LIMIT 500"
    )?;
    
    let rows = stmt.query_map([], |row| {
        Ok(WindowEvent {
            timestamp: row.get(0)?,
            process_name: row.get(1)?,
            window_title: row.get(2)?,
            duration_seconds: row.get(3)?,
            active_seconds: row.get(4)?,
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
        "SELECT timestamp, process_name, window_title, duration_seconds, active_seconds 
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
            active_seconds: row.get(4)?,
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
        "SELECT timestamp, process_name, window_title, duration_seconds, active_seconds 
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
            active_seconds: row.get(4)?,
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
        let next_day = last_dt + chrono::Days::new(1);
        if today_dt == next_day {
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

/// Unlock an achievement and award bonus XP the first time it is earned.
/// Returns `true` if the achievement was newly unlocked (and XP awarded).
pub fn unlock_achievement_with_reward(conn: &Connection, code: &str, timestamp: &str, reward_xp: u32) -> Result<bool> {
    let inserted = conn.execute(
        "INSERT OR IGNORE INTO achievements (code, unlocked_at) VALUES (?1, ?2)",
        (code, timestamp),
    )?;
    if inserted > 0 && reward_xp > 0 {
        add_xp(conn, reward_xp)?;
    }
    Ok(inserted > 0)
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

/// Tables emptied by "clear all data".
///
/// Their DDL lives in `init_schema` only: this list is dropped and `init_schema` recreates
/// it, so the schema keeps one owner instead of a second copy here (D-027).
const BULK_TABLES: [&str; 5] = [
    "activity_snapshots",
    "window_events",
    "app_usage",
    "input_activity",
    "achievements",
];

/// Free pages ÷ total pages above which a startup `VACUUM` is worth its wait.
const FREELIST_VACUUM_THRESHOLD: f64 = 0.20;

/// Delete every recorded row, reset the counters, and make the deletion real on disk.
///
/// Three steps, in this order, and the order is the whole point:
///
/// 1. **One transaction** for the deletes and the `user_stats` reset. The old code ran them
///    outside a transaction, so an interruption could leave the stats table empty — and
///    every later `update_streak` then fails against a missing row, silently (P2-5).
/// 2. **`VACUUM`**, which rewrites the file: deleted rows do not vanish from the pages they
///    sat in, they become free pages that still hold their bytes. Measured 0.18 s on an
///    emptied 285 MB database.
/// 3. **`wal_checkpoint(TRUNCATE)`**, without which neither of the above reaches the file:
///    in WAL mode the rewritten database sits in the `-wal`, so measured straight after a
///    clear the main file was still 285 MB and still held **3,627** copies of a window
///    title. After the checkpoint: 0.06 MB, zero copies.
///
/// What that costs the tracking loop: 0.44 s of total hold, measured with a second
/// connection writing every 100 ms — one tick at most, no lost snapshot.
pub fn clear_database(conn: &Connection) -> Result<()> {
    let started = std::time::Instant::now();
    let bytes_before = file_span_bytes(conn);

    {
        let tx = conn.unchecked_transaction()?;
        for table in BULK_TABLES {
            // Names are compile-time constants, never user input.
            tx.execute(&format!("DELETE FROM \"{table}\""), [])?;
        }
        tx.execute("DELETE FROM user_stats", [])?;
        tx.execute(
            "INSERT INTO user_stats (id, total_xp, current_level, current_streak) VALUES (1, 0, 1, 0)",
            [],
        )?;
        tx.commit()?;
    }

    conn.execute_batch("VACUUM")?;
    conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()))
        .or_else(|e| {
            // A busy checkpoint only means the pages stay until the next one; not fatal.
            log::warn!("Clear: wal checkpoint after vacuum did not truncate: {}", e);
            Ok::<(), rusqlite::Error>(())
        })?;

    let bytes_after = file_span_bytes(conn);
    log::info!(
        "Cleared all data: {} tables emptied, user_stats reset to one row, database {} -> {} bytes in {:?}",
        BULK_TABLES.len(),
        bytes_before,
        bytes_after,
        started.elapsed()
    );
    Ok(())
}

/// Size of the database plus its `-wal`, i.e. what it actually occupies in the folder.
fn file_span_bytes(conn: &Connection) -> u64 {
    let page_size: u64 = conn
        .query_row("PRAGMA page_size", [], |row| row.get(0))
        .unwrap_or(4096);
    let pages: u64 = conn
        .query_row("PRAGMA page_count", [], |row| row.get(0))
        .unwrap_or(0);
    pages * page_size
}

/// Reclaim space left behind by a clear that was interrupted before its `VACUUM`, or by a
/// retention delete.
///
/// `VACUUM` rewrites the whole database under an exclusive lock, so it must never run while
/// the tracking loop is writing (D-027). Startup is the safe moment: the loop has not
/// started yet. The checkpoint afterwards is what actually returns the space to the folder.
pub fn vacuum_if_fragmented(conn: &Connection) -> Result<bool> {
    let pages: i64 = conn.query_row("PRAGMA page_count", [], |row| row.get(0))?;
    let free: i64 = conn.query_row("PRAGMA freelist_count", [], |row| row.get(0))?;
    if pages == 0 {
        return Ok(false);
    }
    let ratio = free as f64 / pages as f64;
    if ratio < FREELIST_VACUUM_THRESHOLD {
        return Ok(false);
    }

    let started = std::time::Instant::now();
    conn.execute_batch("VACUUM")?;
    let _ = conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()));
    let pages_after: i64 = conn.query_row("PRAGMA page_count", [], |row| row.get(0))?;
    log::info!(
        "Vacuumed on startup: {:.0}% of {} pages were free, {} pages left, took {:?}",
        ratio * 100.0,
        pages,
        pages_after,
        started.elapsed()
    );
    Ok(true)
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
    /// Wall-clock span of the event, first tick -> last tick. Includes idle time.
    pub duration_seconds: u32,
    /// Seconds inside that span where the machine was not idle. `None` only on rows
    /// recorded before the column existed and not yet backfilled.
    pub active_seconds: Option<u32>,
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

#[cfg(test)]
mod tests {
    use super::*;

    /// A window event recorded before `active_seconds` existed: span set, column NULL.
    fn insert_legacy_event(conn: &Connection, start: &str, duration: u32) {
        conn.execute(
            "INSERT INTO window_events (timestamp, process_name, window_title, duration_seconds, active_seconds)
             VALUES (?1, 'Claude.exe', 'Claude', ?2, NULL)",
            (start, duration),
        )
        .unwrap();
    }

    fn stored_active(conn: &Connection) -> Option<i64> {
        conn.query_row("SELECT active_seconds FROM window_events LIMIT 1", [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn backfill_counts_only_non_idle_seconds_inside_the_span() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();

        // A 10-second event starting at 09:00:00.
        insert_legacy_event(&conn, "2026-10-28T09:00:00.000Z", 10);

        // Active at 00,01,02,03 -> 4. Idle at 05,06 -> excluded.
        // 09:00:10 is the exclusive end boundary: it belongs to the next second and
        // must not be counted, which is what pins the strftime arithmetic.
        for (offset, idle) in [(0, false), (1, false), (2, false), (3, false), (5, true), (6, true), (10, false)] {
            let ts = format!("2026-10-28T09:00:{:02}.000Z", offset);
            insert_activity_snapshot(&conn, &ts, idle, if idle { 120 } else { 0 }).unwrap();
        }

        let filled = backfill_window_event_active_seconds(&conn).unwrap();

        assert_eq!(filled, 1);
        assert_eq!(
            stored_active(&conn),
            Some(4),
            "idle seconds and the exclusive end boundary must both be excluded"
        );
    }

    #[test]
    fn backfill_runs_once_and_leaves_filled_rows_alone() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_legacy_event(&conn, "2026-10-28T09:00:00.000Z", 3);
        insert_activity_snapshot(&conn, "2026-10-28T09:00:01.000Z", false, 0).unwrap();

        assert_eq!(backfill_window_event_active_seconds(&conn).unwrap(), 1);
        assert_eq!(stored_active(&conn), Some(1));

        // Nothing left with NULL -> the startup pass is a no-op on every later run.
        assert_eq!(backfill_window_event_active_seconds(&conn).unwrap(), 0);
        assert_eq!(stored_active(&conn), Some(1));
    }

    #[test]
    fn an_event_with_no_snapshots_stays_at_zero_not_null() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        // Span inside a tracking gap: the machine was off, so no second was observed.
        insert_legacy_event(&conn, "2026-09-24T10:00:00.000Z", 600);

        backfill_window_event_active_seconds(&conn).unwrap();

        assert_eq!(stored_active(&conn), Some(0));
    }

    #[test]
    fn new_rows_store_the_active_seconds_they_were_given() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_window_event(&conn, "2026-10-28T09:00:00.000Z", "chrome.exe", "Docs", 14832, 540).unwrap();

        let (span, active): (u32, Option<u32>) = conn
            .query_row(
                "SELECT duration_seconds, active_seconds FROM window_events",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();

        assert_eq!(span, 14832, "the wall-clock span is still stored");
        assert_eq!(active, Some(540), "active seconds are stored alongside it");
    }

    #[test]
    fn normalising_folds_case_variants_without_losing_seconds() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        // The same app on one day, reported with two casings.
        upsert_app_usage(&conn, "2026-10-28", "Claude.exe", 261).unwrap();
        upsert_app_usage(&conn, "2026-10-28", "claude.exe", 3269).unwrap();

        let (folded, _) = normalise_process_names(&conn).unwrap();

        assert_eq!(folded, 1, "the duplicate-cased row is folded away");
        let rows: Vec<(String, u32)> = conn
            .prepare("SELECT process_name, total_seconds FROM app_usage")
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<Result<_>>()
            .unwrap();
        assert_eq!(
            rows,
            vec![("claude.exe".to_string(), 3530)],
            "seconds are summed onto the surviving row, not dropped"
        );
    }

    #[test]
    fn normalising_relabels_events_and_keeps_every_row() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        insert_window_event(&conn, "2026-10-28T09:00:00.000Z", "Claude.exe", "Claude", 60, 60).unwrap();
        insert_window_event(&conn, "2026-10-28T09:01:00.000Z", "claude.exe", "Claude", 60, 60).unwrap();

        let (_, relabelled) = normalise_process_names(&conn).unwrap();

        assert_eq!(relabelled, 1);
        let unnamed: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM window_events WHERE process_name <> lower(process_name)",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let total: i64 = conn
            .query_row("SELECT COUNT(*) FROM window_events", [], |r| r.get(0))
            .unwrap();
        assert_eq!(unnamed, 0);
        assert_eq!(total, 2, "relabelling must never delete events");
    }

    #[test]
    fn normalising_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        upsert_app_usage(&conn, "2026-10-28", "Hermes.exe", 10).unwrap();

        assert_eq!(normalise_process_names(&conn).unwrap(), (1, 0));
        assert_eq!(normalise_process_names(&conn).unwrap(), (0, 0));
    }

    /// A clear must leave a *usable* database: every bulk table empty, and exactly one
    /// `user_stats` row. A missing stats row makes every later `update_streak` fail
    /// silently — that is the interruption P2-5 described, and this pins its absence.
    #[test]
    fn clear_empties_the_bulk_tables_and_keeps_one_stats_row() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO activity_snapshots (timestamp, is_idle) VALUES ('2026-10-31T00:00:00.000Z', 0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO window_events (timestamp, process_name, window_title, duration_seconds, active_seconds)
             VALUES ('2026-10-31T00:00:00.000Z', 'claude.exe', 'Claude', 60, 40)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO achievements (code, unlocked_at) VALUES ('first_day', '2026-10-31T00:00:00.000Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE user_stats SET total_xp = 333430, current_level = 34, current_streak = 7",
            [],
        )
        .unwrap();

        clear_database(&conn).unwrap();

        for table in BULK_TABLES {
            let rows: i64 = conn
                .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
                .unwrap();
            assert_eq!(rows, 0, "{table} must be empty after a clear");
        }
        let (rows, xp, level, streak): (i64, i64, i64, i64) = conn
            .query_row(
                "SELECT COUNT(*), MAX(total_xp), MAX(current_level), MAX(current_streak) FROM user_stats",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap();
        assert_eq!(rows, 1, "a clear must leave exactly one user_stats row");
        assert_eq!((xp, level, streak), (0, 1, 0), "stats must be reset, not merely kept");
    }

    /// Clearing twice is a plausible user action — a double click, or a retry after a slow
    /// first attempt. The second run must not fail on tables the first run dropped.
    #[test]
    fn clear_can_run_twice() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        clear_database(&conn).unwrap();
        clear_database(&conn).unwrap();
        let rows: i64 = conn
            .query_row("SELECT COUNT(*) FROM user_stats", [], |r| r.get(0))
            .unwrap();
        assert_eq!(rows, 1);
    }

    /// A compact database must not pay for a VACUUM on every startup: the free-page gate
    /// is what keeps startup fast, and a check that never goes false is not a gate.
    #[test]
    fn vacuum_is_skipped_when_nothing_is_free() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        assert!(!vacuum_if_fragmented(&conn).unwrap());
    }

    /// The achievement loop retries the same unlock constantly; each refusal must not cost
    /// an id. Measured before the fix: five refused duplicates pushed the next row from
    /// id 2 to id 6.
    #[test]
    fn refused_achievements_do_not_burn_ids() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        for _ in 0..5 {
            assert!(!unlock_achievement_with_reward(&conn, "early_bird", "2026-10-31T00:00:00.000Z", 0).unwrap());
        }
        assert!(unlock_achievement_with_reward(&conn, "night_owl", "2026-10-31T00:00:00.000Z", 0).unwrap());

        let rows: Vec<(i64, String)> = {
            let mut stmt = conn.prepare("SELECT id, code FROM achievements ORDER BY id").unwrap();
            let mapped = stmt
                .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
                .unwrap()
                .collect::<std::result::Result<Vec<_>, _>>()
                .unwrap();
            mapped
        };
        assert_eq!(rows, vec![(1, "early_bird".to_string()), (2, "night_owl".to_string())]);
    }

    /// The migration has to keep every unlocked achievement and its id — a rebuilt table
    /// that silently renumbered or emptied itself would look like "you lost your badges".
    #[test]
    fn rebuild_preserves_ids_and_stops_the_burn() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE achievements (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 code TEXT NOT NULL UNIQUE,
                 unlocked_at TEXT NOT NULL
             );",
        )
        .unwrap();
        for (id, code) in [(1, "early_bird"), (4, "night_owl"), (10, "consistency_king")] {
            conn.execute(
                "INSERT INTO achievements (id, code, unlocked_at) VALUES (?1, ?2, '2026-08-13T18:09:54.142Z')",
                (id, code),
            )
            .unwrap();
        }

        assert!(drop_achievement_autoincrement(&conn).unwrap(), "old schema must be rebuilt");
        assert!(!drop_achievement_autoincrement(&conn).unwrap(), "a second run must be a no-op");

        let ddl: String = conn
            .query_row("SELECT sql FROM sqlite_master WHERE name = 'achievements'", [], |r| r.get(0))
            .unwrap();
        assert!(!ddl.to_uppercase().contains("AUTOINCREMENT"), "keyword must be gone: {ddl}");

        let ids: Vec<i64> = {
            let mut stmt = conn.prepare("SELECT id FROM achievements ORDER BY id").unwrap();
            stmt.query_map([], |r| r.get(0)).unwrap().map(|r| r.unwrap()).collect()
        };
        assert_eq!(ids, vec![1, 4, 10], "ids must survive the rebuild");

        // Two refused duplicates, then a real unlock: the new row takes max+1, not max+n.
        unlock_achievement_with_reward(&conn, "early_bird", "2026-10-31T00:00:00.000Z", 0).unwrap();
        unlock_achievement_with_reward(&conn, "early_bird", "2026-10-31T00:00:00.000Z", 0).unwrap();
        unlock_achievement_with_reward(&conn, "streak_30", "2026-10-31T00:00:00.000Z", 0).unwrap();
        let new_id: i64 = conn
            .query_row("SELECT id FROM achievements WHERE code = 'streak_30'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(new_id, 11, "a refused duplicate must not advance the id");
    }
}
