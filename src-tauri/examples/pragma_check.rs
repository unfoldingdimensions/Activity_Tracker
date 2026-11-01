//! The connection the app actually opens must carry the pragmas D-040 relies on.
//!
//! `cargo run --example pragma_check`
//!
//! Rust tests cannot run on this machine (a test binary linking the tauri stack dies at load with
//! STATUS_ENTRYPOINT_NOT_FOUND), so this checks the real `init_database` — included by path, no
//! tauri — on a throwaway directory.
//!
//! What it proves: journal_mode is WAL, synchronous is NORMAL (1), temp_store is MEMORY (2). If
//! someone deletes a pragma, the durability and fsync assumptions recorded in D-040 stop holding and
//! this fails instead of quietly costing a millisecond per commit.

#[path = "../src/export.rs"]
#[allow(dead_code)]
mod export;
#[path = "../src/database.rs"]
#[allow(dead_code)]
mod database;

use rusqlite::Connection;

fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let dir = std::env::temp_dir().join("at-pragma-check");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir)?;

    let conn = database::init_database(dir.clone())?;
    let journal: String = conn.query_row("PRAGMA journal_mode", [], |r| r.get(0))?;
    let synchronous: u32 = conn.query_row("PRAGMA synchronous", [], |r| r.get(0))?;
    let temp_store: u32 = conn.query_row("PRAGMA temp_store", [], |r| r.get(0))?;
    drop(conn);

    let mut failures = Vec::new();
    let mut check = |ok: bool, what: String| {
        if ok {
            println!("  ok    {what}");
        } else {
            println!("  FAIL  {what}");
            failures.push(what);
        }
    };

    println!("database opened by init_database:");
    check(journal.eq_ignore_ascii_case("wal"), format!("journal_mode is wal (got {journal})"));
    check(synchronous == 1, format!("synchronous is NORMAL=1 (got {synchronous})"));
    check(temp_store == 2, format!("temp_store is MEMORY=2 (got {temp_store})"));

    // `synchronous` is per-connection rather than a property of the file — a connection opened
    // without `init_database` gets SQLite's default (FULL). `init_database` is the app's only writer,
    // so that is where the pragma belongs; this note exists so the next reader does not try to "fix"
    // it into the schema.
    println!(
        "\nnote: synchronous is per-connection; only the writer opened by init_database carries NORMAL"
    );

    let _ = std::fs::remove_dir_all(&dir);
    if failures.is_empty() {
        println!("\npragma checks passed");
        Ok(())
    } else {
        Err(format!("{} check(s) failed", failures.len()).into())
    }
}
