//! Page arithmetic for the per-app drill-down (D-039).
//!
//! `cargo run --example drilldown_paging`
//!
//! Rust tests cannot run on this machine — a test binary that links the tauri stack dies at load
//! with STATUS_ENTRYPOINT_NOT_FOUND — so the invariants of the new paginated query are checked here,
//! against a real sqlite database and the real `database.rs`, which is included by path so this
//! binary links no tauri code.
//!
//! What it proves: the total is the range's real count, pages tile the result with no gap and no
//! duplicate, ordering is newest-first, the app filter holds, and an offset past the end is empty
//! rather than an error.

use activity_core::database;

use chrono::{Duration, TimeZone, Utc};
use rusqlite::Connection;
use std::collections::HashSet;

const CHROME: u32 = 1000;
const OPERA: u32 = 100;

fn iso(minutes: i64) -> String {
    (Utc.with_ymd_and_hms(2026, 10, 30, 0, 0, 0).unwrap() + Duration::minutes(minutes))
        .format("%Y-%m-%dT%H:%M:%S.000Z")
        .to_string()
}

fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let db_path = std::env::temp_dir().join("at-drilldown-paging.db");
    let _ = std::fs::remove_file(&db_path);
    let conn = Connection::open(&db_path)?;
    database::init_schema(&conn)?;

    {
        let mut stmt = conn.prepare(
            "INSERT INTO window_events (timestamp, process_name, window_title, duration_seconds, active_seconds)
             VALUES (?1, ?2, ?3, 60, 55)",
        )?;
        for i in 0..CHROME {
            stmt.execute(rusqlite::params![iso(i as i64), "chrome.exe", format!("tab {i}")])?;
        }
        for i in 0..OPERA {
            stmt.execute(rusqlite::params![iso(i as i64), "opera.exe", "music"])?;
        }
    }

    let start = iso(-1);
    let end = iso(CHROME as i64 + 1);
    let mut failures: Vec<String> = Vec::new();
    let mut check = |ok: bool, what: &str| {
        if ok {
            println!("  ok    {what}");
        } else {
            failures.push(what.to_string());
            println!("  FAIL  {what}");
        }
    };

    println!("fixture: {CHROME} chrome.exe events + {OPERA} opera.exe, 2026-10-30");

    // 1. The total counts the selected app only.
    let (_, total) = database::get_window_events_for_process_in_range_paginated(
        &conn, "chrome.exe", &start, &end, 250, 0,
    )?;
    check(total == CHROME, &format!("total is {CHROME} for chrome.exe (got {total})"));

    // 2. Pages tile the range: 250+250+250+250 with no gap and no duplicate.
    let mut seen: HashSet<String> = HashSet::new();
    let mut page = 0u32;
    let mut last_timestamp: Option<String> = None;
    let mut ordered = true;
    while page * 250 < CHROME {
        let (events, page_total) = database::get_window_events_for_process_in_range_paginated(
            &conn,
            "chrome.exe",
            &start,
            &end,
            250,
            page * 250,
        )?;
        check(
            page_total == CHROME,
            &format!("page {page} reports the same total ({page_total})"),
        );
        let expected_len = 250.min(CHROME - page * 250) as usize;
        check(
            events.len() == expected_len,
            &format!("page {page} has {expected_len} rows (got {})", events.len()),
        );
        for event in &events {
            if !seen.insert(event.timestamp.clone()) {
                check(false, &format!("duplicate row {} on page {page}", event.timestamp));
            }
            if event.process_name != "chrome.exe" {
                check(false, &format!("page {page} leaked {}", event.process_name));
            }
            if let Some(previous) = &last_timestamp {
                if previous <= &event.timestamp {
                    ordered = false;
                }
            }
            last_timestamp = Some(event.timestamp.clone());
        }
        page += 1;
    }
    check(seen.len() == CHROME as usize, &format!("pages covered {CHROME} distinct rows (got {})", seen.len()));
    check(ordered, "rows are strictly newest-first across page boundaries");

    // 3. An offset past the end is empty, not an error.
    let (beyond, beyond_total) = database::get_window_events_for_process_in_range_paginated(
        &conn,
        "chrome.exe",
        &start,
        &end,
        250,
        CHROME,
    )?;
    check(beyond.is_empty(), "an offset past the end returns no rows");
    check(beyond_total == CHROME, "an offset past the end still reports the total");

    // 4. A narrow range narrows the total, which is what makes "N of M" honest.
    let (narrow, narrow_total) =
        database::get_window_events_for_process_in_range_paginated(&conn, "chrome.exe", &iso(0), &iso(99), 250, 0)?;
    check(narrow_total == 100, &format!("a 100-minute window counts 100 rows (got {narrow_total})"));
    check(narrow.len() == 100, &format!("and returns all of them (got {})", narrow.len()));

    let _ = std::fs::remove_file(&db_path);
    if failures.is_empty() {
        println!("\nall drill-down paging checks passed");
        Ok(())
    } else {
        Err(format!("{} check(s) failed", failures.len()).into())
    }
}
