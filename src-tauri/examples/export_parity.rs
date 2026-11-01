//! Byte-for-byte parity check for `src/export.rs`.
//!
//! Rust tests cannot run on this machine — any binary that links the tauri stack dies at load with
//! STATUS_ENTRYPOINT_NOT_FOUND — so the check that "the streaming export produces exactly what the
//! old export produced" has to be something that actually executes. This is it:
//!
//! ```text
//! cd src-tauri && cargo run --example export_parity
//! ```
//!
//! It builds the fixture database, writes both formats with the shipping writers, and compares the
//! bytes with `tests/fixtures/export-golden.{csv,json}` — files produced by the pre-T2
//! implementation (Vecs + `serde_json::to_string_pretty`) before it was deleted. `export.rs` is
//! included by path so this binary links no tauri code.

use activity_core::export;

use rusqlite::Connection;
use std::fs;

fn compare(label: &str, actual: &[u8], expected: &[u8]) -> Result<(), String> {
    if actual == expected {
        println!("  {label}: identical ({actual_len} bytes)", actual_len = actual.len());
        return Ok(());
    }

    let first_diff = actual
        .iter()
        .zip(expected.iter())
        .position(|(a, b)| a != b)
        .unwrap_or(actual.len().min(expected.len()));
    let line = expected[..first_diff.min(expected.len())]
        .iter()
        .filter(|b| **b == b'\n')
        .count()
        + 1;
    let window = |bytes: &[u8]| {
        let start = first_diff.saturating_sub(40);
        String::from_utf8_lossy(&bytes[start..(first_diff + 40).min(bytes.len())]).replace('\n', "\\n")
    };
    Err(format!(
        "{label}: differs at byte {first_diff} (line {line})\n  actual:   {}\n  expected: {}",
        window(actual),
        window(expected)
    ))
}

fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let root = env!("CARGO_MANIFEST_DIR");
    let fixture = fs::read_to_string(format!("{root}/tests/fixtures/export-fixture.sql"))?;
    let db_path = std::env::temp_dir().join("at-export-parity.db");
    let _ = fs::remove_file(&db_path);

    let conn = Connection::open(&db_path)?;
    conn.execute_batch(&fixture)?;

    println!("fixture database: {}", db_path.display());

    let mut csv = Vec::new();
    export::write_csv(&conn, &mut csv)?;
    compare(
        "csv against golden",
        &csv,
        &fs::read(format!("{root}/tests/fixtures/export-golden.csv"))?,
    )?;

    let mut json = Vec::new();
    export::write_json(&conn, &mut json, "FIXED")?;
    compare(
        "json against golden",
        &json,
        &fs::read(format!("{root}/tests/fixtures/export-golden.json"))?,
    )?;

    // Empty tables: serde prints `[]`, and an export of a fresh install must not be malformed JSON.
    let empty_path = std::env::temp_dir().join("at-export-parity-empty.db");
    let _ = fs::remove_file(&empty_path);
    let empty = Connection::open(&empty_path)?;
    empty.execute_batch(&fixture[..fixture.find("INSERT").expect("fixture has inserts")])?;

    let mut empty_json = Vec::new();
    export::write_json(&empty, &mut empty_json, "FIXED")?;
    let expected_empty = serde_json::to_string_pretty(&serde_json::json!({
        "exported_at": "FIXED",
        "app_usage": [],
        "window_events": [],
        "input_activity": [],
    }))?;
    compare("json, empty database (vs serde)", &empty_json, expected_empty.as_bytes())?;

    let mut empty_csv = Vec::new();
    export::write_csv(&empty, &mut empty_csv)?;
    compare(
        "csv, empty database",
        &empty_csv,
        b"date,process_name,total_seconds\n\nwindow_events\ntimestamp,process_name,window_title,duration_seconds,active_seconds\n\ninput_activity\ntimestamp,keystrokes,mouse_clicks,mouse_distance\n",
    )?;

    println!("all export parity checks passed");
    Ok(())
}
