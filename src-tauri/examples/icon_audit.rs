//! How many of the apps in the real history can this machine actually locate an executable for?
//!
//! `cargo run --example icon_audit [-- --db <path>] [--verbose]`
//!
//! Reads the live database read-only and runs the same resolver the icon extractor uses
//! (`src/icon_paths.rs`, included by path so nothing here links the tauri stack). Rust tests cannot run on this
//! machine, so this is the executable check that the resolver covers what it claims — it is also the number quoted
//! in D-045.

#[path = "../src/icon_paths.rs"]
#[allow(dead_code)]
mod icon_paths;

use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut db = r"C:\ProgramData\ActivityTracker\activity.db".to_string();
    let mut verbose = false;
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--db" => db = args.next().unwrap_or(db),
            "--verbose" => verbose = true,
            other => eprintln!("ignoring unknown argument {other}"),
        }
    }

    let conn = rusqlite::Connection::open_with_flags(
        &db,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_URI,
    )?;
    let names: Vec<String> = conn
        .prepare(
            "SELECT process_name FROM app_usage
             UNION
             SELECT process_name FROM window_events
             ORDER BY 1",
        )?
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    let mut resolved = Vec::new();
    let mut missing = Vec::new();
    for name in &names {
        match icon_paths::resolve(name) {
            Some(path) => resolved.push((name.clone(), path)),
            None => missing.push(name.clone()),
        }
    }

    if verbose {
        for (name, path) in &resolved {
            println!("ok	{name}	{}", path.display());
        }
    }
    for name in &missing {
        println!("none	{name}");
    }

    let total = names.len();
    let running = running_exes();
    let legacy = names
        .iter()
        .filter(|n| legacy_resolve(n, &running).is_some())
        .count();
    println!(
        "\nbefore (running process or System32/C:\\Windows only): {legacy}/{total} ({:.0} %)",
        legacy as f64 / total as f64 * 100.0
    );
    println!(
        "after  (registry + Start Menu + install dirs):       {}/{total} ({:.0} %)",
        resolved.len(),
        resolved.len() as f64 / total as f64 * 100.0
    );
    println!(
        "still missing: {} ({:.0} %)",
        missing.len(),
        missing.len() as f64 / total as f64 * 100.0
    );

    // Group the misses by shape, because "installer that no longer exists" and "a real app we cannot find"
    // are different problems and only the second one is worth chasing.
    let installers = missing
        .iter()
        .filter(|n| {
            let n = n.to_lowercase();
            n.contains("setup") || n.contains("installer") || n.starts_with("un") || n.contains("-win-")
        })
        .count();
    println!(
        "of the missing: {installers} look like installers or versioned down­loads, {} look like real apps",
        missing.len() - installers
    );
    let _ = PathBuf::new();
    Ok(())
}

/// The resolver as it was before this work: a running process with that name, or the file sitting in
/// System32 / `C:\Windows`. Kept here so the before/after numbers come from the same program.
fn legacy_resolve(name: &str, running: &std::collections::HashMap<String, PathBuf>) -> Option<PathBuf> {
    if let Some(exe) = running.get(name) {
        return Some(exe.clone());
    }
    for dir in [r"C:\Windows\System32", r"C:\Windows"] {
        let candidate = PathBuf::from(dir).join(name);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

/// Every executable a process is running right now, keyed by the name the tracker stores.
fn running_exes() -> std::collections::HashMap<String, PathBuf> {
    let mut sys = sysinfo::System::new_all();
    sys.refresh_processes_specifics(
        sysinfo::ProcessesToUpdate::All,
        true,
        sysinfo::ProcessRefreshKind::nothing().with_exe(sysinfo::UpdateKind::Always),
    );
    let mut map = std::collections::HashMap::new();
    for process in sys.processes().values() {
        if let Some(exe) = process.exe() {
            map.insert(process.name().to_string_lossy().to_lowercase(), exe.to_path_buf());
        }
    }
    map
}
