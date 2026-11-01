//! Streaming export of the whole history.
//!
//! The export used to read three tables into `Vec`s and build one ~30 MB `String` while holding the
//! tracker's shared connection. That held the DB mutex for the whole job — measured 1.1 s just to
//! read `input_activity` — and the 1 Hz recorder waits on that mutex, so exporting silently cost
//! recorded seconds (D-037).
//!
//! Two properties this module exists to hold:
//!
//! 1. **Bounded memory.** Every row is written as it is read, through whatever `Write` the caller
//!    passes (`BufWriter<File>` in production). Nothing accumulates per row, so a three-year
//!    database streams in the same footprint as a three-day one.
//! 2. **Byte-identical output.** The format is pinned by `tests/fixtures/export-golden.{csv,json}`,
//!    produced by the pre-T2 implementation, and checked by `examples/export_parity.rs`. The JSON
//!    key order is significant: the old code built objects with `serde_json::json!`, whose `Map` is
//!    a `BTreeMap`, so every object is emitted with **alphabetically sorted keys**.
//!
//! The module deliberately depends on nothing but `rusqlite`, `serde_json` and `std`: the parity
//! harness links this file directly, and a binary that links the tauri stack does not start on this
//! machine (STATUS_ENTRYPOINT_NOT_FOUND — the same blocker as `cargo test`).

use rusqlite::Connection;
use std::io::Write;

/// Row order is part of the export format, so the SQL lives here and `database::get_all_*` borrows
/// these constants rather than repeating them: two copies of an `ORDER BY` is how an export and a
/// screen end up disagreeing about which row is "first".
pub const ALL_APP_USAGE_SQL: &str =
    "SELECT date, process_name, total_seconds FROM app_usage ORDER BY date, total_seconds DESC";
pub const ALL_WINDOW_EVENTS_SQL: &str = "SELECT timestamp, process_name, window_title, duration_seconds, active_seconds FROM window_events ORDER BY timestamp";
pub const ALL_INPUT_ACTIVITY_SQL: &str =
    "SELECT timestamp, keystrokes, mouse_clicks, mouse_distance FROM input_activity ORDER BY timestamp";

pub type ExportResult<T> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

/// CSV field: quote when the value contains a comma, a quote or a newline, doubling inner quotes.
fn csv_field(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

/// A JSON string literal, escaped by serde rather than by hand.
fn json_str(value: &str) -> ExportResult<String> {
    Ok(serde_json::to_string(value)?)
}

/// Write the three tables as three sheets joined by blank lines.
pub fn write_csv(conn: &Connection, out: &mut impl Write) -> ExportResult<()> {
    writeln!(out, "date,process_name,total_seconds")?;
    let mut stmt = conn.prepare(ALL_APP_USAGE_SQL)?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let date: String = row.get(0)?;
        let name: String = row.get(1)?;
        let seconds: u32 = row.get(2)?;
        writeln!(out, "{},{},{}", csv_field(&date), csv_field(&name), seconds)?;
    }

    write!(
        out,
        "\nwindow_events\ntimestamp,process_name,window_title,duration_seconds,active_seconds\n"
    )?;
    let mut stmt = conn.prepare(ALL_WINDOW_EVENTS_SQL)?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let timestamp: String = row.get(0)?;
        let name: String = row.get(1)?;
        let title: Option<String> = row.get(2)?;
        let duration: u32 = row.get(3)?;
        let active: Option<u32> = row.get(4)?;
        writeln!(
            out,
            "{},{},{},{},{}",
            csv_field(&timestamp),
            csv_field(&name),
            csv_field(title.as_deref().unwrap_or("")),
            duration,
            active.map(|s| s.to_string()).unwrap_or_default()
        )?;
    }

    write!(
        out,
        "\ninput_activity\ntimestamp,keystrokes,mouse_clicks,mouse_distance\n"
    )?;
    let mut stmt = conn.prepare(ALL_INPUT_ACTIVITY_SQL)?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let timestamp: String = row.get(0)?;
        let keys: u32 = row.get(1)?;
        let clicks: u32 = row.get(2)?;
        let distance: u32 = row.get(3)?;
        writeln!(out, "{},{},{},{}", csv_field(&timestamp), keys, clicks, distance)?;
    }
    Ok(())
}

/// State of one streaming JSON array: serde prints `[]` for an empty array, so the closing bracket
/// has to know whether anything was written.
struct RowArray {
    wrote_any: bool,
}

impl RowArray {
    /// Emit the separator before a row (a newline for the first, a comma and a newline after).
    /// Call `close_row` before the next `begin_row` — the row closes itself.
    fn begin_row(&mut self, out: &mut impl Write) -> ExportResult<()> {
        if self.wrote_any {
            writeln!(out, ",")?;
        } else {
            writeln!(out)?;
            self.wrote_any = true;
        }
        write!(out, "    {{")?;
        Ok(())
    }

    /// Emit the key/value separator inside a row.
    fn key(&mut self, out: &mut impl Write, key: &str) -> ExportResult<()> {
        write!(out, "\n      \"{key}\": ")?;
        Ok(())
    }

    /// Close the row that is currently open.
    fn close_row(&mut self, out: &mut impl Write) -> ExportResult<()> {
        write!(out, "\n    }}")?;
        Ok(())
    }

    /// Close the array, with the comma that separates it from the next key.
    fn end(self, out: &mut impl Write) -> ExportResult<()> {
        if self.wrote_any {
            writeln!(out)?;
            writeln!(out, "  ],")?;
        } else {
            writeln!(out, "],")?;
        }
        Ok(())
    }

    /// Same as `end` but without the trailing comma (the last array in the document).
    fn end_last(self, out: &mut impl Write) -> ExportResult<()> {
        if self.wrote_any {
            writeln!(out)?;
            writeln!(out, "  ]")?;
        } else {
            writeln!(out, "]")?;
        }
        Ok(())
    }
}

/// Write the whole history as the JSON document the app has always produced: keys sorted
/// alphabetically (serde_json's `Map` is a `BTreeMap`), two-space indent, no trailing newline.
pub fn write_json(conn: &Connection, out: &mut impl Write, exported_at: &str) -> ExportResult<()> {
    writeln!(out, "{{")?;

    write!(out, "  \"app_usage\": [")?;
    let mut array = RowArray { wrote_any: false };
    let mut stmt = conn.prepare(ALL_APP_USAGE_SQL)?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let date: String = row.get(0)?;
        let name: String = row.get(1)?;
        let seconds: u32 = row.get(2)?;
        array.begin_row(out)?;
        array.key(out, "date")?;
        write!(out, "{}", json_str(&date)?)?;
        write!(out, ",")?;
        array.key(out, "process_name")?;
        write!(out, "{}", json_str(&name)?)?;
        write!(out, ",")?;
        array.key(out, "total_seconds")?;
        write!(out, "{}", seconds)?;
        array.close_row(out)?;
    }
    array.end(out)?;

    write!(out, "  \"exported_at\": {},", json_str(exported_at)?)?;
    writeln!(out)?;

    write!(out, "  \"input_activity\": [")?;
    let mut array = RowArray { wrote_any: false };
    let mut stmt = conn.prepare(ALL_INPUT_ACTIVITY_SQL)?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let timestamp: String = row.get(0)?;
        let keys: u32 = row.get(1)?;
        let clicks: u32 = row.get(2)?;
        let distance: u32 = row.get(3)?;
        array.begin_row(out)?;
        array.key(out, "keystrokes")?;
        write!(out, "{keys}")?;
        write!(out, ",")?;
        array.key(out, "mouse_clicks")?;
        write!(out, "{clicks}")?;
        write!(out, ",")?;
        array.key(out, "mouse_distance")?;
        write!(out, "{distance}")?;
        write!(out, ",")?;
        array.key(out, "timestamp")?;
        write!(out, "{}", json_str(&timestamp)?)?;
        array.close_row(out)?;
    }
    array.end(out)?;

    write!(out, "  \"window_events\": [")?;
    let mut array = RowArray { wrote_any: false };
    let mut stmt = conn.prepare(ALL_WINDOW_EVENTS_SQL)?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let timestamp: String = row.get(0)?;
        let name: String = row.get(1)?;
        let title: Option<String> = row.get(2)?;
        let duration: u32 = row.get(3)?;
        let active: Option<u32> = row.get(4)?;
        array.begin_row(out)?;
        array.key(out, "active_seconds")?;
        match active {
            Some(active) => write!(out, "{active}")?,
            None => write!(out, "null")?,
        }
        write!(out, ",")?;
        array.key(out, "duration_seconds")?;
        write!(out, "{duration}")?;
        write!(out, ",")?;
        array.key(out, "process_name")?;
        write!(out, "{}", json_str(&name)?)?;
        write!(out, ",")?;
        array.key(out, "timestamp")?;
        write!(out, "{}", json_str(&timestamp)?)?;
        write!(out, ",")?;
        array.key(out, "window_title")?;
        match title {
            Some(title) => write!(out, "{}", json_str(&title)?)?,
            None => write!(out, "null")?,
        }
        array.close_row(out)?;
    }
    array.end_last(out)?;

    write!(out, "}}")?;
    Ok(())
}
