//! Temporary benchmark: pre-T2 export vs the streaming export, on whatever database you point it
//! at. Deleted once the numbers are recorded in D-037; `examples/export_parity.rs` is the harness
//! that stays.
//!
//!   cargo run --release --example export_bench -- old <db> <out.json>
//!   cargo run --release --example export_bench -- new <db> <out.json>
//!
//! Peak working set is read from outside (see the poller) because it cannot be measured after the
//! fact and the `windows` crate feature for `GetProcessMemoryInfo` is not enabled here.

use activity_core::export;

use rusqlite::{Connection, OpenFlags};
use std::time::Instant;

fn old_export(conn: &Connection) -> String {
    let app_usage: Vec<(String, String, u32)> = conn
        .prepare("SELECT date, process_name, total_seconds FROM app_usage ORDER BY date, total_seconds DESC")
        .unwrap()
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    let window_events: Vec<(String, String, Option<String>, u32, Option<u32>)> = conn
        .prepare("SELECT timestamp, process_name, window_title, duration_seconds, active_seconds FROM window_events ORDER BY timestamp")
        .unwrap()
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    let input_activity: Vec<(String, u32, u32, u32)> = conn
        .prepare("SELECT timestamp, keystrokes, mouse_clicks, mouse_distance FROM input_activity ORDER BY timestamp")
        .unwrap()
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();

    let snapshot = serde_json::json!({
        "exported_at": "FIXED",
        "app_usage": app_usage.iter().map(|(date, name, seconds)| serde_json::json!({
            "date": date, "process_name": name, "total_seconds": seconds
        })).collect::<Vec<_>>(),
        "window_events": window_events.iter().map(|(timestamp, name, title, duration, active)| serde_json::json!({
            "timestamp": timestamp, "process_name": name, "window_title": title,
            "duration_seconds": duration, "active_seconds": active
        })).collect::<Vec<_>>(),
        "input_activity": input_activity.iter().map(|(timestamp, keys, clicks, distance)| serde_json::json!({
            "timestamp": timestamp, "keystrokes": keys, "mouse_clicks": clicks, "mouse_distance": distance
        })).collect::<Vec<_>>(),
    });
    serde_json::to_string_pretty(&snapshot).unwrap()
}

fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let args: Vec<String> = std::env::args().collect();
    let (mode, db, out) = (&args[1], &args[2], &args[3]);

    let conn = Connection::open_with_flags(
        db,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;

    let started = Instant::now();
    match mode.as_str() {
        "old" => {
            let contents = old_export(&conn);
            std::fs::write(out, &contents)?;
        }
        "new" => {
            let file = std::fs::File::create(out)?;
            let mut writer = std::io::BufWriter::new(file);
            export::write_json(&conn, &mut writer, "FIXED")?;
            std::io::Write::flush(&mut writer)?;
        }
        other => return Err(format!("unknown mode {other}").into()),
    }
    let elapsed = started.elapsed();
    let bytes = std::fs::metadata(out)?.len();
    println!("mode={mode} elapsed_ms={} bytes={bytes}", elapsed.as_millis());
    Ok(())
}
