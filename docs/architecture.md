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
src/utils/*                     pure functions (classification, formatters, focus sessions, editorial copy)
src/api/tauri.ts                THE invoke() boundary — every command signature lives here
        ↕ Tauri IPC (26 commands)
src-tauri/src/commands.rs       thin command layer: lock state, call the domain, map errors
src-tauri/src/tracker.rs        the 1 Hz loop, gamification, limits, cleanup scheduling
src-tauri/src/database.rs       ALL SQL: schema, inserts, reads, aggregates
src-tauri/src/windows_api.rs    the Win32 boundary (foreground window, process name, idle seconds)
src-tauri/src/icons.rs          icon extraction + on-disk cache (base64 to the UI)
```

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
| Icon extraction | per request | `commands.rs:500-523` | `spawn_blocking` so icon work never stalls the UI |
| Tray builder | once | `lib.rs:80-134` | tray icon, menu (Open Dashboard / Quit), popup positioning |

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
(`lib.rs:39-44`). WAL journal, `page_size` 4096, no `VACUUM`, no freelist. Measured 2026-10-31: **283 MB /
3.05 M rows / 4 MB WAL**.

| Table | Grain | Key columns | Measured rows |
|---|---|---|---|
| `activity_snapshots` | 1 row per second while running | `timestamp`, `is_idle`, `idle_seconds` | 3,054,487 |
| `window_events` | 1 row per foreground-app period | `timestamp` (start, back-dated), `process_name`, `window_title`, `duration_seconds` (wall-clock span), `active_seconds` (non-idle seconds inside that span) | 61,969 |
| `input_activity` | 1 row per second that had input | `timestamp`, `keystrokes`, `mouse_clicks`, `mouse_distance` | 645,747 |
| `app_usage` | 1 row per (local date, process) | `date`, `process_name`, `total_seconds` · `UNIQUE(date, process_name)` | 1,499 after the name fold |
| `user_stats` | singleton row `id = 1` | `total_xp`, `current_level`, `current_streak`, `last_activity_date` | 1 |
| `achievements` | 1 row per unlock | `code` UNIQUE, `unlocked_at` | 5 |
| `settings` | key/value JSON | `key`, `value` | 14 |

Indexes: `timestamp` on the three event tables, `date` on `app_usage`.

`process_name` is stored **lowercase** everywhere: identity is case-insensitive and the display name is the
UI's job (`formatAppName`), because Windows reports the casing baked into the executable and one app arrived
as both `Claude.exe` and `claude.exe` (D-021). Anything keyed by a process name — icon cache files, maps,
query parameters — must fold case the same way.

`window_events.active_seconds` was added 2026-10-31 (D-018). Rows written after that store it
directly; rows recorded earlier are filled once at startup from `activity_snapshots` by
`backfill_window_event_active_seconds` (`database.rs`), before the tracking loop starts. `NULL` means
"not backfilled yet", and the frontend falls back to `duration_seconds` — so an un-backfilled row
renders without crashing, only less precisely.

**Time convention (the rule most likely to be broken by a change):**
- Every `timestamp` is **UTC** ISO-8601 with milliseconds and a literal `Z` (`windows_api.rs:137-139`).
- `app_usage.date` is the **local** calendar date (`windows_api.rs:142-144`).
- Local day boundaries are converted to a UTC range at read time (`tracker.rs:733-749`).
- Per-hour timeline buckets are grouped in UTC in SQL and re-bucketed into *local hours* in Rust
  (`database.rs:302-359`). That function's buckets are keyed by hour only, so it is correct for a single
  local day and wrong for multi-day ranges.

## 5. Command surface (26, `lib.rs:177-204`)

| Group | Commands |
|---|---|
| Session / window | `show_main_window`, `hide_tray_window`, `start_tracking`, `stop_tracking`, `is_tracking`, `get_active_window`, `get_idle_seconds` |
| Today reads | `get_daily_stats`, `get_app_usage`, `get_activity_timeline`, `get_recent_events` |
| Range reads | `get_stats_range`, `get_app_usage_range`, `get_timeline_range_paginated`, `get_timeline_range_for_app`, `get_input_history`, `get_input_history_range`, `get_all_app_usage` |
| Settings | `get_settings`, `set_settings` |
| Gamification | `get_user_stats`, `get_unlocked_achievements` |
| System / data | `get_cpu_snapshot`, `get_app_icon`, `export_data`, `clear_data` |

All 26 are invoked from the frontend; none are orphans. Adding one touches five files — see `AGENTS.md`.

## 6. Where a metric is owned

Every user-visible number has exactly one source of truth. That table lives in `docs/flow.md` §4 and is
binding: a second derivation of the same number is a defect, not an optimisation.

## 7. Known structural debt

- **Single connection behind a mutex.** A 283 MB `VACUUM` in `clear_data` (`database.rs:604-616`) holds that
  mutex while the 1 Hz loop needs it, so snapshots stop for the duration.
- **Two resident WebView2 windows** (main + hidden tray popup, `tauri.conf.json`), the dominant idle RAM floor.
- **God files**: `pages/Settings.tsx` 910, `tracker.rs` 846, `pages/Timeline.tsx` 595, `pages/Tools.tsx` 570.
- **No Rust test suite.** Zero `#[cfg(test)]` in `src-tauri/src`; all 88 tests are frontend.
- **Logs** live at `%ProgramData%\ActivityTracker\logs\activity-tracker.log`, bounded at three files of 2 MB.
  Logging is registered in **every** build (D-024); per-tick detail stays at `debug!`, so the file carries app
  switches, cleanup runs, unlocks and errors rather than every second.
