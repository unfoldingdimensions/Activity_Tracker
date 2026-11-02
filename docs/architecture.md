# Architecture

> Verified against commit `f51775a` on 2026-10-31. Update this file in the same commit as the code it describes.
> Measured facts (LOC, row counts, sizes) are from that date; re-measure rather than trusting them after a schema or loop change.

## 1. Shape in one paragraph

A tray-resident **Tauri v2** desktop app. A Rust backend polls the Win32 foreground window once per second and
writes four content-free tables into a local SQLite file; a React 19 frontend reads those tables through Tauri
commands and derives every screen from them. There is no server, no network call, and no telemetry. The
frontend never touches SQL, and the backend never computes a product metric — it returns rows, the UI decides
what they mean.

Stack: Tauri 2.9.5 · React 19.2 · TypeScript 5.9 · Vite 7.2 · rusqlite 0.35 (bundled SQLite) ·
TanStack Query 5.90 · Recharts 3.7 · Tailwind v4 + a hand-written token layer (`DESIGN.md`).

Size: ~14.2k LOC in the two source trees (`src/` TS/TSX, `src-tauri/src/` Rust).

## 2. Layers

```
src/pages/*                     route screens (Dashboard, Timeline, Activity, Power, Tools, Settings, TrayPopup)
src/components/{dashboard,...}  presentational components; may call hooks, never invoke()
src/hooks/**                    data hooks: React Query wrappers + domain derivation
src/utils/*                     pure functions (classification, formatters, focus sessions, baseline median, row rules, editorial copy)
src/api/tauri.ts                THE invoke() boundary — every command signature lives here
        ↕ Tauri IPC (27 commands)
src-tauri/src/commands.rs       thin command layer: lock state, call the domain, map errors
src-tauri/src/tracker.rs        the 1 Hz loop, gamification, limits, cleanup scheduling
src-tauri/src/windows_api.rs    the Win32 boundary (foreground window, process name, idle seconds)
src-tauri/src/icons.rs          icon extraction (ExtractIconExW → PNG), the Win32 half
        ↕ plain Rust calls, no IPC and no window handle
core/src/database.rs            ALL SQL: schema, inserts, reads, aggregates
core/src/export.rs              streaming CSV/JSON writers
core/src/icon_paths.rs          exe lookup: registry, Start Menu, bounded sweeps, MSIX manifests
core/src/icon_cache.rs          cache file naming and lookup
core/src/settings_keys.rs       validation of the settings map that arrives as JSON
```

**Two crates, one rule.** `core` (`activity-core`) is a workspace member that links no Tauri, no WebView2 and no window
toolkit, because a test binary that links them cannot load on this machine. That is where a backend rule gets a
`#[test]` that actually runs (`cargo test -p activity-core`, 21 tests, D-057); anything that needs an `AppHandle` stays
in `src-tauri` and is proven by a runnable example or a live invocation instead. `src-tauri/src/lib.rs` re-exports the
moved modules, so `crate::database::…` reads the same as before.

Two files currently bypass the `api/tauri.ts` boundary and import `invoke` directly —
`src/components/shared/AppIcon.tsx:2` and `src/pages/TrayPopup.tsx:4`. That is a layering violation to
correct, not a pattern to copy.

**Win32 boundary rule.** `windows_api.rs` resolves the foreground process with `QueryFullProcessImageNameW`
on a `PROCESS_QUERY_LIMITED_INFORMATION` handle — the access right Windows actually grants for elevated and
packaged processes. `GetModuleBaseNameW` needs `PROCESS_VM_READ`, which those processes refuse; using it is
what produced the `"Unknown"` bucket of 45 h (D-020).

## 3. Runtime topology (Rust)

| Thread / task | Cadence | Where | Owns |
|---|---|---|---|
| Tracking loop | 1 s | `tracker.rs:346-707` | snapshots, input rows, `app_usage` upserts, window events, XP/streak/achievements, limit checks |
| Cleanup thread | checks 60 s, runs every 24 h | `tracker.rs:382-431` | retention deletes (skipped when `retention_days = 0`) |
| Power sampler | 5 s | `tracker.rs:255-284` | top-15 CPU processes via `sysinfo` |
| Icon extraction | per request | `commands.rs` `get_app_icon` | `spawn_blocking` so icon work never stalls the UI |
| Tray builder | once | `lib.rs` `tray_window_height()`, `tray_window()` | tray icon, menu (Open Dashboard / Quit); the popup window is created on first click, not here (D-035) |
| Single-instance guard | once, before anything else | `lib.rs:20-35` | decides whether this process is the instance at all (D-026) |

Shared state is `AppState { tracker: Mutex<Tracker> }` (`commands.rs:15-17`). Inside `Tracker`:

- `db: Arc<Mutex<Connection>>` — **one** SQLite connection behind a mutex. Every read and write serialises on it.
- `settings: Arc<Mutex<HashMap<String, Value>>>` — JSON settings cache, seeded from the DB at startup
  (`tracker.rs:224-232`) and updated through `apply_setting` (`tracker.rs:287-296`). The loop never queries
  settings from the DB.
- `cpu_snapshot`, `current_window` (title already redacted), `is_running` / `loop_active` guards,
  `last_cleanup` + `cleanup_thread_active` (so pause/resume cannot stack cleanup threads).

Guard behaviour worth knowing before touching `start()`: `loop_active` prevents a second loop while one is
still draining, and `is_running` is a cooperative stop flag — the loop exits on its next tick.

## 4. Storage

File: `%ProgramData%\ActivityTracker\activity.db` — machine-wide, shared across Windows profiles
(`lib.rs:39-44`). WAL journal, `page_size` 4096, no freelist, `synchronous=NORMAL` and `temp_store=MEMORY` set by
`init_database` on the app's only writer (D-040). Measured 2026-10-31: **283 MB / 3.05 M rows / 4 MB WAL**.

Retention is deliberately **off** — `retention_days = 0`, ~1.2 GB/year accepted by the owner (D-032). The
cleanup thread runs but skips its deletes; `clear all data` is the only bulk delete.

Two operations reshape the file: `clear_database()` (transaction → `VACUUM` → `wal_checkpoint(TRUNCATE)`, 285 MB
→ 64 KB in 274 ms, D-027) and, at startup, `vacuum_if_fragmented()` when freelist ÷ pages ≥ 20%.

| Table | Grain | Key columns | Measured rows |
|---|---|---|---|
| `activity_snapshots` | 1 row per second while running | `timestamp`, `is_idle`, `idle_seconds` | 3,054,487 |
| `window_events` | 1 row per foreground-app period | `timestamp` (start, back-dated), `process_name`, `window_title`, `duration_seconds` (wall-clock span), `active_seconds` (non-idle seconds inside that span) | 61,969 |
| `input_activity` | 1 row per second that had input | `timestamp`, `keystrokes`, `mouse_clicks`, `mouse_distance` | 645,747 |
| `app_usage` | 1 row per (local date, process) | `date`, `process_name`, `total_seconds` · `UNIQUE(date, process_name)` | 1,499 after the name fold |
| `user_stats` | singleton row `id = 1` | `total_xp`, `current_level`, `current_streak`, `last_activity_date` | 1 |
| `achievements` | 1 row per unlock | `code` UNIQUE, `unlocked_at` | 5 |
| `settings` | key/value JSON | `key`, `value` | 15 |

Indexes: `timestamp` on the three event tables, `date` on `app_usage`.

`process_name` is stored **lowercase** everywhere: identity is case-insensitive and the display name is the
UI's job (`formatAppName`), because Windows reports the casing baked into the executable and one app arrived
as both `Claude.exe` and `claude.exe` (D-021). Anything keyed by a process name — icon cache files, maps,
query parameters — must fold case the same way.

`window_events.active_seconds` was added 2026-10-31 (D-018). Rows written after that store it
directly; rows recorded earlier are filled once at startup from `activity_snapshots` by
`backfill_window_event_active_seconds` (`core/src/database.rs`), before the tracking loop starts. `NULL` means
"not backfilled yet", and the frontend falls back to `duration_seconds` — so an un-backfilled row
renders without crashing, only less precisely.

**Time convention (the rule most likely to be broken by a change):**
- Every `timestamp` is **UTC** ISO-8601 with milliseconds and a literal `Z` (`windows_api.rs:137-139`).
- `app_usage.date` is the **local** calendar date (`windows_api.rs:142-144`).
- Local day boundaries are converted to a UTC range at read time (`tracker.rs:733-749`).
- Per-hour timeline buckets are grouped in UTC in SQL and re-bucketed into *local hours* in Rust
  (`core/src/database.rs:302-359`). That function's buckets are keyed by hour only, so it is correct for a single
  local day and wrong for multi-day ranges.

## 5. Command surface (27, `lib.rs` `generate_handler!`)

| Group | Commands |
|---|---|
| Session / window | `show_main_window`, `hide_tray_window`, `start_tracking`, `stop_tracking`, `is_tracking`, `seconds_since_last_snapshot`, `get_active_window`, `get_idle_seconds` |
| Today reads | `get_daily_stats`, `get_app_usage`, `get_activity_timeline`, `get_recent_events` |
| Range reads | `get_stats_range`, `get_app_usage_range`, `get_timeline_range_paginated`, `get_timeline_range_for_app`, `get_timeline_range_for_app_paginated`, `get_input_history`, `get_input_history_range`, `get_all_app_usage` |
| Settings | `get_settings`, `set_settings` |
| Gamification | `get_user_stats`, `get_unlocked_achievements` |
| System / data | `get_cpu_snapshot`, `get_app_icon`, `export_data`, `clear_data` |

All 26 are invoked from the frontend; none are orphans. Adding one touches five files — see `AGENTS.md`.

## 6. Where a metric is owned

Every user-visible number has exactly one source of truth. That table lives in `docs/flow.md` §4 and is
binding: a second derivation of the same number is a defect, not an optimisation.

## 7. Known structural debt

- **Single connection behind a mutex.** The connection is shared, so any long operation blocks the 1 Hz loop.
  `clear_data` is bounded now — one transaction, `VACUUM`, `wal_checkpoint(TRUNCATE)`, measured 0.21 s total, so
  the loop loses at most one tick (D-027). `VACUUM` from anywhere else still holds the mutex for its duration;
  the startup vacuum in `lib.rs` runs before the loop starts for exactly that reason.
- **One resident WebView2 window at startup** (main, `tauri.conf.json`); the tray popup is built on first click
  (`lib.rs` `tray_window()`), so a session that never opens it never pays its renderer (D-035). After the popup has
  been opened once it stays resident for the rest of the session — it is hidden, not destroyed. Its height follows the
  skin that will draw it (`tray_window_height()`: 380 px flat, 600 px glass), re-applied on every show so switching
  skins cannot leave it the wrong size (D-061).
- **Visibility is two things, and they have one owner.** `visibility::hide/show` hides the window *and* the webview
  inside it; `WebviewWindow::hide()` alone leaves WebView2's controller believing the page is visible, and the
  hidden page then renders at 240 rAF/s for nobody — 55 % of one core measured, 0.3 % after the fix (D-042). No
  caller may call `window.hide()` / `window.show()` directly.
- **God files**: `tracker.rs` 1005, `pages/Settings.tsx` 895, `pages/Timeline.tsx` 660, `pages/Tools.tsx` 570.
- **Rust tests exist and run — but only in `core`.** `cargo test -p activity-core` executes 21 tests in 0.01 s (D-057);
  the failure mode to remember is that `cargo test -p activity-tracker-v2` still dies at process load with
  `STATUS_ENTRYPOINT_NOT_FOUND`, so a `#[test]` written in `src-tauri` **does not run at all**. Put the logic in `core`
  and the test beside it; never add a test to the app crate and call the rule covered.
- **Logs** live at `%ProgramData%\ActivityTracker\logs\activity-tracker.log`, bounded at three files of 2 MB.
  Logging is registered in **every** build (D-024); per-tick detail stays at `debug!`, so the file carries app
  switches, cleanup runs, unlocks and errors rather than every second.
