# Decisions

Append-only. New entries go at the bottom with the next number and today's date. **Never edit or delete an
entry** — supersede it: add a new entry and set the old one's status to `Superseded by D-0xx`.

Status vocabulary: `Active` (in force) · `Superseded by D-0xx` · `Open` (decided, not yet built) ·
`Under review` (a recorded defect may change it).

Provenance tag says where the fact comes from: `[code]` reconstructed from the source as built, intent not
otherwise documented · `[commit abc1234]` · `[plan]` · `[owner]` a decision the owner made explicitly.

---

## D-001 · Timestamps in UTC, day buckets in local time
**2026-08-13 · Active · [code]** `windows_api.rs:137-144`
- Every `timestamp` column stores UTC ISO-8601 with millis and `Z`; `app_usage.date` stores the **local**
  calendar date; local day boundaries are converted to UTC ranges at read time (`tracker.rs:733-749`).
- Why: rows stay unambiguous across DST and machine moves, while per-day aggregation matches what the user
  calls "today".
- Consequence: any new query must know which of the two it is filtering on. Mixing them silently returns
  empty sets — this already happened once and is guarded by a comment in `useDashboardData.ts:373-375`.

## D-002 · One SQLite connection behind a mutex, WAL journal
**2026-08-13 · Active · [code]** `database.rs:7-13`, `tracker.rs:198`
- Why: single writer process, no pool dependency, and WAL keeps reads from blocking the 1 Hz insert.
- Consequence: every read serialises against every write. Long operations (`VACUUM` in `clear_data`,
  `export_data` materialising three whole tables) stall the capture loop for their duration.

## D-003 · Retention configurable, default 90 days, `0` = keep forever; no VACUUM in cleanup
**2026-08-13 · Active · [code]** `tracker.rs:399-422`, `database.rs:571-601`
- Why: freed pages are reused, so skipping `VACUUM` avoids holding the write lock while the loop needs it.
- Consequence: the current value is `0`, so nothing is ever deleted — 283 MB at 78 days, ~1.3 GB/year.

## D-004 · Data directory is machine-wide: `%ProgramData%\ActivityTracker`
**2026-08-13 · Active · [code]** `lib.rs:39-44`, README
- Why: one history per machine rather than per Windows profile.
- Consequence: permissions follow `ProgramData` inheritance (creator-owned); a second Windows user may be
  able to read but not write the DB.

## D-005 · A window event is closed on process change, with wall-clock duration and a back-dated start
**2026-08-13 · Superseded by D-018 · [code]** `tracker.rs:532-555`
- Why: one row per foreground period, written once, no per-second updates.
- Consequence (measured 2026-10-31): `duration_seconds` includes idle time — 49.4% of all event time in the
  last 10 days sits inside tracked-idle snapshots. Every duration-based surface overstates by that share.
  *Conflicts with P1-1 in `.hermes/recon/2026-10-31_recon-and-log-findings.md`; the owner may downgrade or
  change this decision — record which.* The in-flight event is also lost on pause/quit.

## D-006 · Window titles are stored, minus user-configured redaction keywords
**2026-08-13 · Active · [code]** `tracker.rs:143-194`, `474-481`
- Titles are stored verbatim unless a redaction keyword matches; `tracked_window_titles = false` stores an
  empty string. Default keyword list is empty.
- Consequence: window titles are the most sensitive data in the DB and the most useful for the Timeline.

## D-007 · Gamification curve: 10 XP per active minute, level = floor(sqrt(xp/100)) + 1
**2026-08-13 · Active · [code]** `tracker.rs:622-642`, `formatters.ts:217-227`
- Mirrored in the frontend; a change on one side without the other desynchronises the progress bar.
- Consequence: XP is a linear function of active minutes, so it is a second (redundant) copy of screen time.

## D-008 · Release builds register no logger
**2026-08-13 · Superseded by D-024 · [code]** `lib.rs:29-35`
- Why: keeps the shipped binary quiet and smaller; the memory review recorded it as "release-safe".
- Consequence: every `log::error!` on the write path is a no-op in the shipped app, so a failed insert is
  invisible. Raising this is a decision to make before debugging any "my data is missing" report.

## D-009 · Apps are merged case-insensitively in the dashboard sidebar only
**2026-08-14 · Under review · [commit 3ba4c31] · `AppUsageSide.tsx:30-42`**
- Windows reports both `Claude.exe` and `claude.exe`; the sidebar folds them together.
- Consequence: the Activity page (`Activity.tsx:97`) and the Timeline drill-down (exact `process_name` match)
  do not, so the same app appears twice on one screen and under-reports on another. 31 of 69 days affected.

## D-010 · Unclassified and unresolved processes default to "distraction"
**2026-08-13 · Under review · [code]** `appClassification.ts:46`
- Why: an unknown app should not be rewarded with focus credit.
- Consequence: process-name resolution failures (`"Unknown"`, 45.2 h measured, mostly elevated/UWP windows)
  are scored as distraction and deflate the focus score.

## D-011 · Range reads cap at 5,000 window events
**2026-08-14 · Superseded by D-017 · [code]** `useTimeline.ts:82-83`
- Why: an explicit guard against multi-MB arrays in the JS heap ("prevent memory explosion").
- Consequence: silent truncation — a 30-day range holds ~21k events, so only the newest ~9.5 days render.
  Nothing in the UI signals that data was dropped.

## D-012 · Query errors degrade to zero instead of surfacing
**2026-08-13 · Superseded by D-025 · [code]** `database.rs:232-291`
- `unwrap_or(0)` on each aggregate, `unwrap_or_default()` on each read in `tracker.rs`.
- Why: a failed widget should not blank a screen.
- Consequence: a schema or lock problem looks exactly like "you did nothing today". Pairs with D-008 —
  nothing reports it.

## D-013 · `DESIGN.md` is the authority for tokens and values
**2026-08-06 · Active · [owner]** `DESIGN.md`
- Portable agent rules put design-token authority with the design doc: on any conflict between a rule here
  and `DESIGN.md`, `DESIGN.md` wins on **values** (colour, type, spacing) and the conflict is raised, not
  decided silently.

## D-015 · One commit per fix or feature
**2026-10-31 · Active · [owner]**
- Each fix or feature lands as its own commit, with its tests and the docs it invalidates; never two fixes,
  never a behaviour change mixed with formatting, renames or dependency bumps.
- Why: a commit that cannot be described in one sentence cannot be reviewed, bisected or reverted alone — and
  the project already carries a nine-week-old approved plan nobody can attribute because the work is invisible
  (see D-014).
- Consequence: more commits than before, each smaller. A multi-file change is fine when it is one feature
  (the five-file backend checklist, `AGENTS.md` §1.5); the test for a fix ships in the same commit as the fix.
- Recorded in `AGENTS.md` §1.8 as the binding form of this rule.

## D-016 · Memory/performance plan approved but not implemented
**2026-08-17 · Superseded by D-033 · [plan] `.hermes/plans/2026-08-17_133000-memory-leak-review-optimization.md`**
- Open Questions marked RESOLVED on 2026-08-17 (full plan, Phases 0-5, lazy tray window, load-more
  pagination, export streaming).
- Verified 2026-10-31: none of the nine code items has landed — `limit_notified` still unpruned,
  `AppIcon` cache still unbounded, Toast ids still only added, `useFocusCalendar` still fetches the whole
  table every 60 s, no `gcTime`, no `[profile.release]`, no SQLite pragmas beyond WAL, no per-day aggregate
  command, no settings whitelist.
- Consequence: an approved plan is not a built feature. Re-verify against the code before citing it as done.

## D-017 · Range events are collected in full, and the list renders in batches
**2026-10-31 · Active · [code] · supersedes D-011**
- `useTimelineEventsRange` walks `get_timeline_range_paginated` in 2,000-row pages until the range is
  exhausted (`src/utils/timelinePaging.ts`, `src/hooks/queries/useTimeline.ts`). A 200,000-event guard remains
  as a runaway limit and **throws** instead of returning a partial range.
- The Timeline log renders 250 rows per batch behind a visible "newest N of M" row with a "Show more"
  control, in both skins (`pages/Timeline.tsx`).
- Why: the old single call returned the newest 5,000 events and silently dropped the rest — measured
  5,000 of 20,990 for a 30-day window, reaching back only 9.5 days, so the Month view described a month from
  a third of it (P0-1 in the 2026-10-31 recon).
- Consequence: event-derived numbers now cover a whole range, so the Focus Flow chart, deep-work sessions and
  the digest changed for Month/Week views — the earlier readings were incomplete, not wrong-but-comparable.
  Historical data needs no migration: the rows were always there.
- Also: `refetchInterval` now polls only while the range still contains "now", since the payload is the whole
  range rather than one page.

## D-018 · Time in app is measured in active seconds, not wall-clock span
**2026-10-31 · Active · [code] · supersedes D-005**
- `window_events` gains `active_seconds`: a counter incremented once per non-idle tick for the current
  foreground window (`tracker.rs:346-590`). `duration_seconds` keeps the wall-clock span, so the difference
  stays explicable instead of disappearing.
- The frontend normalises at the read boundary (`src/utils/windowEvents.ts`): `duration_seconds` becomes
  `active_seconds` when present, the original is kept as `wall_clock_seconds`, and `active_seconds = 0` is
  treated as a real value rather than as missing.
- Rows recorded before the column existed are backfilled once at startup from `activity_snapshots`
  (`database.rs::backfill_window_event_active_seconds`, called from `lib.rs` before the loop starts). The SQL
  counts non-idle snapshots inside each span with the timestamp index — measured ~9 s for 62k events, and it
  reproduces the independently measured 49.5% idle share.
- Why: the wall-clock span absorbed idle time — 49.4% of all event time in the last 10 days — which inflated
  Focus Flow, deep-work sessions, the Timeline and the sub-day app split (P1-1 in the 2026-10-31 recon).
- Consequence: historical and future durations are comparable for the first time, so past Focus Flow readings
  will *drop* where an app sat focused through an idle stretch. Events inside a tracking gap backfill to 0
  active seconds, which is correct: no second was ever observed. A failed backfill is non-fatal — readers fall
  back to `duration_seconds` — but it is only logged, and release builds register no logger (D-008).

## D-019 · "Focus score" means exactly one thing, and it is not the active/idle ratio
**2026-10-31 · Active · [code]**
- **Focus score** = `focusSeconds / (focusSeconds + distractionSeconds)` over `app_usage`, where apps classified
  `ignore` are removed from both sides of the ratio. One implementation: `src/utils/focusScore.ts`, with tests.
- `formatStatsForCards` no longer produces a `focusScore`. It computed `active / (active + idle)` — an activity
  ratio, not a focus measure — and only looked harmless because `useDashboardData` overwrote the field before
  returning. Any new caller would have inherited the wrong number under the right name.
- The Focus Flow chart keeps its own ratio on purpose: focus seconds over each interval's **wall time**, so idle
  shows as a segment. It is labelled "share of each interval" at the call site, and the difference in
  denominators is the reason the two numbers are not equal (documented in `docs/flow.md` §4).
- `useAnalytics`' internal `focusScore` (100 − switching penalty) is renamed `stabilityScore`: it feeds the flow
  composite and is a third quantity, so it may not borrow the name.
- Why: three different quantities answered to "focus score" across the dashboard, the tray popup and the flow
  metrics (recon finding P1-2). A user comparing two screens saw a contradiction that was really two metrics.
- Consequence: the card and the tray popup now show the same number by construction, and the chart says what it
  is a share *of*. If a future screen needs the active/idle ratio it must be named for the clock, not for focus.

## D-020 · Process names resolve via QueryFullProcessImageNameW; unattributable rows are not judged
**2026-10-31 · Active · [code]**
- `get_process_name` opens the process with `PROCESS_QUERY_LIMITED_INFORMATION` only, resolves the image path
  with `QueryFullProcessImageNameW`, and takes the file name from that path (`windows_api.rs`).
- The previous code asked for `PROCESS_QUERY_INFORMATION | PROCESS_VM_READ` and fell back to a limited handle
  for `GetModuleBaseNameW` — which itself needs `PROCESS_VM_READ`, so the fallback could never succeed. Every
  elevated or packaged window therefore arrived as `"Unknown"`: 45.2 h measured (~8% of tracked time), of which
  AutoClaw alone accounted for 1,029 window events, then Task Manager, Windows Security and admin shells.
- `classifyApp` returns `ignore` for exactly the name `"Unknown"` (case-insensitive; an explicit user override
  still wins), so unattributable time leaves the ratio instead of being scored as distraction.
- Why: the focus score was being deflated by the tracker's own resolver failure (recon finding P1-3).
- Consequence: historical rows keep the name they were written with — they cannot be re-attributed, only
  excluded. A process that refuses even `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)` still lands in
  `"Unknown"` and is now excluded rather than judged. History shows an `"Unknown"` bucket until it ages out;
  the Timeline still lists those rows, they simply no longer colour the score.

## D-021 · Process identity is case-insensitive: one lowercase form is stored
**2026-10-31 · Active · [code]**
- `windows_api::get_active_window` lowercases the resolved executable name, so every write is already
  normalised. `formatAppName` produces the display name; storage no longer carries capitalisation.
- The startup migration `normalise_process_names` folds history: `app_usage` rows differing only by case are
  summed onto one row (mindful of `UNIQUE(date, process_name)`), and `window_events` rows are relabelled in
  place. Idempotent by construction — afterwards `process_name <> lower(process_name)` matches nothing.
- Why: Windows reports the casing baked into the executable, so one app arrived as both `Claude.exe` and
  `claude.exe`. 31 of 69 days carried both, 35.9 h of Claude time was divided between them, the Activity page
  rendered two rows for one app, and the per-app drill-down matched only whichever casing it was given
  (recon finding P1-4).
- Ran on this machine after verifying on a copy: 39 `app_usage` rows folded, 39,980 events relabelled,
  total seconds identical before and after (2,003,295 s), merge spot-checked (2026-08-14 Claude 261 s +
  3,269 s → 3,530 s), second pass a no-op.
- Consequence: every consumer keyed by process name had to be re-checked, and the icon system was the real
  risk — `sysinfo::processes_by_name` is a **case-sensitive substring match**, and the on-disk icon cache held
  mixed-case filenames, so an app that was not currently running would have lost its icon entirely. Both
  lookups are case-insensitive now and existing cache files are reused (`icons.rs::cached_icon_path`).

## D-022 · Release builds come from the Tauri CLI, and the database is not evidence the UI works
**2026-10-31 · Active · [code]**
- `tauri::is_dev()` is `!cfg!(feature = "custom-protocol")` (`tauri-2.9.5/src/lib.rs:314`). Only
  `npm run tauri build` — which enables `tauri/custom-protocol` — embeds `../dist`. A bare
  `cargo build --release` produces a binary that boots `devUrl` (`http://localhost:5173`) and renders
  `ERR_CONNECTION_REFUSED` inside its own window.
- Why this is recorded as a decision and not a footnote: for ~90 minutes every "verified" claim in this session
  was a *database* claim — snapshots advancing, `active_seconds` populating, migrations idempotent — while the
  app window showed a connection error. The capture loop does not care which URL the webview loaded, so nothing
  failed. The user found it, twice.
- Consequence: UI-affecting changes are now evidenced by a captured window (`PrintWindow` +
  `PW_RENDERFULLCONTENT`, after `ShowWindow(SW_RESTORE)` because the app starts minimised), not by row counts.
- Related: the Aug-14 NSIS install in `%LOCALAPPDATA%\Activity Tracker v2` shipped without
  `WebView2Loader.dll`, so its desktop/Start-menu shortcut had never worked; the folder now carries a
  CLI-built exe plus the DLL copied from the build output. A fresh `npm run tauri build` bundle should replace
  those hand-copied files (the bundler is the only thing that also fixes `uninstall.exe`).

## D-023 · The bundle ships WebView2Loader.dll itself, and only builds NSIS
**2026-10-31 · Active · [code]** `src-tauri/tauri.conf.json`, `src-tauri/WebView2Loader.dll`
- The exe imports `WebView2Loader.dll` dynamically, but tauri-bundler's NSIS payload contains **only** the app
  binary — verified with `7z l` on both installers: the Aug-14 one listed 7 files and no DLL, the new one lists
  8 including it. Every install from a bundle therefore died at launch with "The code execution cannot proceed
  because WebView2Loader.dll was not found", which is exactly what the desktop shortcut did.
- So the DLL is vendored at `src-tauri/WebView2Loader.dll` and declared in `bundle.resources`, landing next to
  the installed exe. It is Microsoft's redistributable loader shim, version-agnostic, 160 KB.
- `bundle.targets` changed from `"all"` to `["nsis"]`: `"all"` also asks for an MSI, and that step needs WiX,
  which is not cached here and could not be downloaded (`failed to bundle project: timeout: global`). This
  project has only ever produced NSIS installers.
- Consequence: `npm run tauri build` now succeeds offline and produces an installer that can actually run.
  Re-check after any Tauri upgrade — `7z l "<setup>.exe"` must still list `activity-tracker-v2.exe` **and**
  `WebView2Loader.dll` — and keep the vendored DLL in step with the `webview2-com`/`windows` versions in
  `Cargo.lock`.

## D-024 · Logging is configured in every build, into a bounded file next to the database
**2026-10-31 · Active · [code] · supersedes D-008**
- `setup()` registers `tauri-plugin-log` unconditionally: level `Info`, target
  `TargetKind::Folder { %ProgramData%\ActivityTracker\logs, "activity-tracker" }`, rotation `KeepSome(3)` at
  2 MB per file, plus stdout in debug builds only.
- The per-tick `Recording input` line is `debug!` now, so the release log carries events — app switches, cleanup
  runs, streak/achievement unlocks, errors — instead of thousands of lines a minute.
- Why: with no logger in release, every `log::error!` on the write path was a no-op, so a failed insert looked
  exactly like an idle day. That silence is what let this session's faults (dev-mode binary, name migration,
  idle-inflated durations) hide behind green database counts (P2-1, L-09).
- Verified by injection rather than by the file existing: a `BEGIN EXCLUSIVE` lock held for 8 s produced
  `[2026-10-31][08:38:15][app_lib::tracker][ERROR] Failed to insert activity snapshot: database is locked` in
  the release log, and tracking resumed at full rate afterwards (52 snapshots in the following minute).
- Consequence: a bug report can now carry one file from `logs/`. The log is machine-wide like the database, and
  `Info` is the floor — anything per-tick belongs at `debug!`.

## D-025 · A degraded read names itself: keep the fallback, remove the silence
**2026-10-31 · Active · [code] · supersedes D-012**
- Every read that can fail now goes through one of two thin helpers: `database::degrade(what, result, fallback)`
  for a single query, and `Tracker::read(what, fallback, |conn| …)` for a whole getter — the latter also catches a
  poisoned mutex, which used to return an empty list. Both log `warn` with the failing query's name and the driver
  message, then return the fallback unchanged.
- The fallback stays. A failed widget must not blank a screen (D-012's original reason still holds); what changes
  is that the failure now leaves a trace.
- Reads that **gate work** no longer degrade at all: the `active_seconds` backfill and the process-name
  normalisation count their pending rows with `?`, because a failed count would silently skip a migration.
- `app_limits` no longer parses with `unwrap_or_default()` — a malformed setting used to disable the distraction
  guard without a word. The per-tick parses (blacklist, redacted keywords) stay silent on purpose: a warn per
  second would bury the signal, and they are re-parsed from the same cached value.
- Verified against a genuine failed read in a release build: a stub database whose `activity_snapshots` has no
  `is_idle` column produced
  `[WARN] Query failed [daily active seconds]: no such column: is_idle … reporting a default so the surface stays readable`,
  the dashboard still rendered (Screen Time 4 h 21 m, Focus Flow drawn, app bars populated), and the swap was
  rolled back byte-for-byte — 3,070,676 snapshots / 62,408 events / 2,007,210 s verified identical before and
  after, ~71 s of capture lost during the swap.
- Consequence: a broken read costs one log line instead of a day of unexplained zeros.

## D-026 · One instance per session, and a second launch is a request to see the window
**2026-10-31 · Active · [code] · closes P2-7**
- `tauri-plugin-single-instance` is registered as the **first** plugin — before autostart, the tray webview and the
  1 Hz tracker thread — so a second process exits before it can open the database or write a row.
- Pinned `=2.3.1` on purpose: 2.4+ requires `tauri >= 2.10`, which drags the crate past `@tauri-apps/api 2.9.1`
  and the CLI refuses to build mismatched minor versions. Upgrading the Tauri stack is its own commit, not a
  rider on a bug fix.
- The Windows half of the plugin creates the mutex `com.activitytracker.app-sim` **without** a `Global\` prefix, so
  the guard is per Windows session, not per machine. Two RDP users could each run an instance against the same
  `%ProgramData%` database. Acceptable for a single-user tool; stated so it is not rediscovered as a bug.
- The second process hands its argv to a hidden window in instance one (`WM_COPYDATA`) and calls
  `std::process::exit(0)`. It never runs `setup()`, never opens the database, never starts a tracker thread.
- `reveal_main_window()` is shared by the tray "Show" item and the second-launch callback, and uses raw
  `ShowWindow(SW_RESTORE) → ShowWindow(SW_SHOW) → SetForegroundWindow` rather than Tauri's
  `show()`/`unminimize()`/`set_focus()`: those return `Ok` and leave the window iconic and hidden, because the
  window is created minimised and the `Resized` handler hides anything that still reports as minimised.
- Measured on the shipped release build, before and after:

  | | two instances, no guard | one instance, guard |
  |---|---|---|
  | snapshots in the window | 40 in 20 s = **2.00/s** | 63 in 63 s = **1.00/s** |
  | duplicate timestamps | 0 — the extra rows are new rows, not constraint violations | 0 |
  | second process | stayed alive and recorded | exits itself in **0.1 s**, code 0 |
  | window after second launch | — | visible, 1294 × 838 |

  Log evidence: `Second launch detected - revealing the running instance`, exactly one startup banner, no
  WARN/ERROR.
- Consequence: autostart plus a shortcut click can no longer double every recorded second. The defect was silent
  by construction — two rows per second, nothing violated, no error, just numbers twice too large.
- Also owed to `AGENTS.md` §1.6: the one-instance rule (plugin registered first, pinned `=2.3.1`, per-session
  mutex). The write to `AGENTS.md` was blocked — the approval prompt timed out — so it is recorded here and not
  retried until the owner approves it (D-013's rule about protected instruction files).

## D-027 · "Clear all data" is one transaction, and it actually reaches the disk
**2026-10-31 · Active · [code] · closes P2-5**
- The clear is now three ordered steps: **one transaction** for the five deletes plus the `user_stats`
  delete+reinsert, then **`VACUUM`**, then **`wal_checkpoint(TRUNCATE)`**.
- **Transaction.** The old code ran seven statements outside any transaction, so an interruption could leave
  `user_stats` empty — and every later `update_streak` then fails against a missing row, silently.
- **Checkpoint.** This is the part the original entry missed. `VACUUM` in WAL mode writes the new database into
  the `-wal`; measured straight after a clear, the main file was **still 285 MB and still held 3,627 copies of a
  window title** from the history the user had just "permanently deleted". After the checkpoint: 65,536 bytes,
  zero copies (scanned the raw bytes for `Remote Sales Pipeline` and `Claude`).
- **Keep the `VACUUM`.** The recon estimated "tens of seconds"; measured on the live 285 MB database it is
  **0.18 s**, because it runs on an emptied database. Dropping it — the obvious "it holds the lock" fix — would
  have made erasure a lie: after a plain transactional delete the file stayed 272.6 MB with **3,624 of 3,627**
  title copies still in it.
- Measured cost to the tracking loop, with a second connection writing every 100 ms: **0.21 s** worst stall, no
  lost snapshot. In the shipped build the log records the real run:
  `Cleared all data: 5 tables emptied, user_stats reset to one row, database 285855744 -> 65536 bytes in 273.8ms`.
- **Interruption tested, not argued:** a run killed after two of the five deletes (never committed) left all
  3,075,304 snapshots, 62,625 events and the stats row intact.
- `vacuum_if_fragmented()` (startup, before the 1 Hz loop) is the safety net for a clear that dies between its
  checkpoint and its commit — it fires only when freelist ÷ page count ≥ 20% and always checkpoints afterwards.
  It is also the hook P2-2's retention will need.
- Rust tests added (`clear_empties_the_bulk_tables_and_keeps_one_stats_row`, `clear_can_run_twice`,
  `vacuum_is_skipped_when_nothing_is_free`) are **compile-verified only** — `cargo test` still cannot load on
  this machine (L-11). The behaviour above was proven by running it.

## P2-8 (open) · Autostart points into the build tree, not at the installed app
**2026-10-31 · Fixed by D-030 · [env]**
- `HKCU\...\Run\Activity Tracker v2` = `E:\DevTools\activity-tracker\target\release\activity-tracker-v2.exe`.
- Consequences: a rebuild cannot replace the binary while it runs (`Access is denied` — hit this while building
  D-027), the installed copy in `%LOCALAPPDATA%\Activity Tracker v2` is a *different* binary from the one that
  starts at sign-in, and "which build am I running?" is unanswerable from the UI.
- Suggested fix: on startup, if autostart is enabled and the registered path differs from the running
  executable, rewrite it (self-heal), and say so in the log at `info`.

## D-028 · An empty title is a fact; a blank row is a bug
**2026-10-31 · Active · [ui] · closes P2-4**
- Measured 2026-10-31: **6,743 of 62,601** window events carry no title (10.8 %). Of those, **5,927 are
  `explorer.exe`** — the desktop and taskbar genuinely have no title — plus chrome 172, `unknown` 144, opera 143,
  claude 112, zcode 54. Today alone: 103 of 672 events.
- The rows rendered `event.window_title || 'No title'` in one skin and `'No Title'` in the other — two spellings of
  the same non-answer, and both read as a failed capture rather than "this window has no title".
- One owner now: `displayWindowTitle(processName, windowTitle)` — a real title is shown trimmed, `explorer.exe`
  renders as **Desktop**, anything else falls back to `formatAppName` (and to "Unattributed" if even that is
  empty). Both skins call it; a source-level test fails if a third skin reintroduces the raw fallback, proven by
  planting one and watching it go red.
- The stored value is **not** changed. `window_events.window_title` keeps `""` because that is what Windows
  reported, and an export must carry the fact rather than the presentation.
- Consequence: no row can render an empty cell. What it does not do is invent information: a titleless Chrome
  window shows "Chrome", which names the app and nothing more.

## D-029 · A segment in flight is closed, not discarded
**2026-10-31 · Active · [code] · closes P2-3**
- The tracking loop breaks on pause, and it broke *before* writing the segment it was accumulating: the current
  app period lived in stack variables that died with the thread.
- **Measured before** (shipped build, 2026-10-31): `hermes.exe` foreground from 13:05:05, pause at 13:05:49 —
  the database gained **nothing**. The last row ended at 13:04:41 + 24 s, so **44 s vanished**; on a long session
  it is the entire run (median focus run 5.4 min), which is why every session's timeline ended early.
- **Measured after**, same operation: `Closed the in-flight window event on stop: claude.exe for 146s`, and one
  row — `timestamp 13:07:35.164Z, claude.exe, "Claude", 146 s, 145 active`.
- How: the segment (`process`, `title`, `start`, `active_seconds`) is published on the Tracker once per tick, so
  it is no longer owned by a stack frame. `close_segment()` writes it with the same arithmetic as the switch path
  (stored timestamp = event start; the row covers `[timestamp, +duration]`). It is called from the loop's stop
  branch and from a `RunEvent::ExitRequested` hook in `lib.rs`, for a quit that lands mid-tick.
- The published copy can be one second stale; the loop stays the only writer of the live values, so there is one
  owner and an export, not two copies that can disagree.
- **Not exercised end-to-end: the quit path** (it needs the tray menu). It calls the same `close_segment()` with
  reason `quit`; the pause run above is the evidence that the helper writes correctly.
- "Resume" was verified too: after Resume at 13:10:44 the loop restarted and snapshots flowed (23 in the
  following minute), so the flush left nothing in a state that blocks a restart.

## D-030 · The autostart entry is corrected to the installed executable
**2026-10-31 · Active · [code] · closes P2-8**
- The registry value `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\Activity Tracker v2` held
  `E:\DevTools\activity-tracker\target\release\activity-tracker-v2.exe` — a cargo build output, not the installed
  copy in `%LOCALAPPDATA%\Activity Tracker v2`.
- Two consequences, both seen this session: signing in started a binary one build behind the installed app, and
  **`npm run tauri build` failed with `Access is denied`** because the binary being written was running.
- Cause: `auto-launch` writes the path of whichever executable enables it, and `is_enabled()` only checks that the
  value *exists*. A stale path is therefore never corrected — it reads as "on" forever.
- Fix: `heal_autostart_entry()` at startup compares the registered value with the running executable and rewrites
  it when they differ, logging the old and new paths. It is skipped when the running binary lives under
  `target/debug` or `target/release`, because a dev build must never register itself as what starts at sign-in.
  A missing value is left missing: creating one would resurrect an entry the user removed.
- Verified both directions on the shipped build:
  - installed copy → `Autostart entry points at "E:\…\target\release\activity-tracker-v2.exe "; rewriting it to C:\Users\ADMIN\AppData\Local\Activity Tracker v2\activity-tracker-v2.exe`, and the registry now holds that path;
  - build-tree copy → `Autostart: running from a build tree; leaving the entry untouched`, registry unchanged.
- The write also refreshes the `StartupApproved` value `auto-launch` keeps, so Windows' startup manager sees the
  same entry rather than a second one.

## D-031 · An achievement id is a rowid, not an identity
**2026-10-31 · Active · [code] · closes P2-6**
- `achievements` was `id INTEGER PRIMARY KEY AUTOINCREMENT` with `code TEXT NOT NULL UNIQUE`. The achievement loop
  retries `INSERT OR IGNORE` constantly, and `AUTOINCREMENT` advances its counter **before** SQLite discovers the
  UNIQUE conflict — so every refusal burned an id. Measured on the live database: **289 attempts, 5 rows, ids
  1, 4, 10, 60 and 117**. Reproduced in isolation: five refused duplicates pushed the next row from id 2 to id 6.
- `code` was always the identity. The counter added nothing except gaps and a `sqlite_sequence` row pretending the
  table had 289 achievements.
- Fix: the keyword is gone (`id INTEGER PRIMARY KEY`), applied to existing databases by
  `drop_achievement_autoincrement()`, a one-time table rebuild inside a transaction that copies rows **by explicit
  id** — the five unlocked achievements keep 1, 4, 10, 60, 117 and nothing that references an id breaks.
- Verified on the shipped build: `Rebuilt achievements without AUTOINCREMENT (ids preserved)`, rows unchanged, DDL
  now `id INTEGER PRIMARY KEY`, and no `sqlite_sequence` row for the table. The migration is idempotent — the next
  startup logged nothing.
- Consequence: a refused unlock now costs a failed UNIQUE check and nothing else. The other tables keep
  `AUTOINCREMENT` because they never use `INSERT OR IGNORE`; if one starts to, this is the same defect.

## D-032 · Retention stays off: the growth rate is accepted
**2026-11-01 · Active · [owner] · P2-2 closed as accepted, not fixed**
- The recon filed P2-2 as "retention is set to forever". The measurement stands: **285 MB over 79 days =
  3.45 MB/day ≈ 1.23 GB/year**, and nothing is ever deleted.
- **Owner's decision (2026-11-01): the growth rate is acceptable.** The default does not change —
  `retention_days` stays `0` and `Forever` stays a first-class option in Settings → Data retention.
- Recorded here so the next pass does not re-derive it:
  - a 30-day cleanup deletes 2,388,689 snapshot + input + event rows. As one `DELETE` per table under the tracker
    mutex that **stalls the 1 Hz loop for 2.21 s**; batched at 5,000 rows with a 20 ms pause it is **0.02 s**
    (14.8 s of background work instead). Any future retention must batch — the shape is settled even though the
    default is not;
  - `app_usage` is the one table keyed by **local** date, so its cutoff must be a local date string, never the UTC
    timestamp cutoff the other three use (§1.1);
  - afterwards the freelist held **63 %** of pages, which `vacuum_if_fragmented()` (D-027) reclaims at the next
    startup: 285 MB → ~105 MB;
  - the Focus Calendar's "focused in the last year" is only true while retention is Forever. Turning retention on
    means changing that label in the same commit.
- Consequence: the file grows ~1.2 GB/year and is never reclaimed. `clear all data` (D-027) remains the only bulk
  delete, and it is the answer for anyone who wants the space back.

## D-033 · The memory plan is re-ranked against measurements, not inspection
**2026-11-01 · Active · [plan] · supersedes D-016**
- D-016's plan was re-measured on the shipped build and revised to
  `.hermes/plans/2026-11-01_d016-revised-plan.md` (local, untracked like the other plans — this entry is the
  durable record of why it changed).
- **Baseline** from the repo's own harness (`scripts/mem-snapshot.ps1`, Private Working Set of the app plus its
  owned WebView2 tree): 2026-08-17 **134.4 MB** → 2026-11-01 **232.4 MB** with the same 7 processes —
  **+98 MB / +73 % in 2.5 months**, and unattributed. Idle working set is 528 MB (46 MB process, 482 MB webviews);
  idle CPU 0.86 % of one core.
- **Re-ranked by measurement.** The only items that move three-digit megabytes or lose recordings are the two
  webview/export ones. Three items the Aug-17 plan called *High* measure at noise: the focus calendar's
  whole-table fetch is **1 ms / 58 KB** per refetch, the per-app drill-down **91 ms / 1.18 MB** (its rendering was
  already batched by D-017), and the pragma work moves **reads by nothing**.
- **Kept because it was measured and would otherwise be re-derived:** `synchronous=NORMAL` takes a commit from
  **1.61 ms to 0.46 ms (−71 %)**, while `cache_size`/`mmap` gain **0 %** because the hot set already fits in 2 MB.
  The profile tuning is a **binary-size** win (36.3 MB), not a CPU win — the loop is 0.86 % of a core.
- **Work list** (three structural, four cheap, three hygiene, in that order): T0.1–T0.3 attribution and probes;
  T1 lazy tray window; T2 stream the export; T3 bound the drill-down; T4 pragmas; T5 release profile; T6 icon cap;
  T7a–c the small leaks; T8 settings whitelist; T9 dead path; T10 input-history churn.
- **Why attribution comes first:** four of the remaining tasks are cache-size claims. A DevTools heap snapshot
  either shows them in the retained set or kills them, and it is the only way to explain +98 MB.
- Consequence: no task in the list is accepted on a code diff — each carries a before/after number from
  `mem-snapshot.ps1` or the query probes.

## D-034 · The footprint is Chromium, not the app's caches

**2026-11-01 · Active · [plan] · closes T0.1–T0.3 of D-033**

- **Tools, one commit each:** `mem-snapshot.ps1 -State <label>` (T0.1, `49262b7`), `db-latency.py` (T0.3,
  `68a2f9f`), `webview-heap.mjs` (T0.2, `e81efc7`). Full report and caveats:
  `.hermes/recon/2026-11-01_memory-attribution.md`.
- **Three states, private working set of the app plus its owned WebView2 tree:** idle-hidden **233.3 MB**,
  dashboard-visible **236.2 MB**, timeline-visible with 20,990 events held **241.4 MB**. Rendering the heaviest
  page in the product costs **+8.1 MB**; the other 233 MB is residency, and it is paid whether or not a window is
  ever shown.
- **Per process (commit charge, not PWS — quoted for ranking only):** gpu-process **168.0 MB**, main renderer
  72.3, browser 48.8, **tray renderer 38.2**, utility 13.6 + 9.4, crashpad 2.3.
- **The app's object graph is 6–9 MB.** Main window JS heap 6.5 MB hidden, 8.6 MB holding a full 30-day range;
  DOM 684 → 2,920 nodes; tray popup 2.8 MB and 140 nodes.
- **Consequences, all of them subtractions:**
  - **T7a/b/c dropped** as memory items (`app_limits` is `{}`; toast ids are dozens of strings; settings are
    144 bytes) and **T10 dropped** (3.9 rows per refetch, nothing sampled while hidden). They were carried over
    from the Aug-17 plan and its premise does not survive measurement.
  - **T6 loses its memory claim**, keeping only the boundedness invariant.
  - **T1's ceiling is one renderer: −38 MB, not the −100 to −130 MB estimated in D-033.** The tray renderer is
    resident from launch and holds 2.8 MB of JS, so the popup costs its process whether opened or not.
  - **New T1b: the GPU process at 168 MB** is now the largest single item and the app writes none of it. It needs a
    flags experiment (`--disable-gpu-compositing`, `--in-process-gpu`, occlusion feature) with a CPU column and a
    screenshot per theme before any adoption.
- **Hot reads (T0.3, median of 7, read-only):** daily stats 0.20 ms, app usage 0.01 ms, timeline page 1.52 ms,
  focus calendar 0.81 ms, drill-down worst app (11,466 rows) 17.39 ms. The database remains a non-issue, which is
  why T3/T4 are small and T2 is a stall-avoidance fix rather than a speed fix.
- **Rule this establishes:** a memory plan item must name the process or object graph it expects to shrink. "It
  holds a cache" is not evidence; a per-process table is.

## D-035 · The tray popup is created on first open

**2026-11-01 · Active · [windows] · implements T1 of D-033/D-034**

- **Before:** `tauri.conf.json` declared a second window (`label: tray`, `/tray`, 380×540, transparent,
  always-on-top, hidden). Chromium started its renderer at launch and kept it for the session: measured 38.2 MB
  of commit charge, 2.8 MB of JS and 140 DOM nodes for a popup most sessions never open.
- **After:** only `main` is declared. `lib.rs::tray_window()` builds the popup on the first left-click with
  `WebviewWindowBuilder` — same URL (`WebviewUrl::App("/tray")` resolves to `http://tauri.localhost/tray`, the
  same document the config produced), same size, decorations, transparency, always-on-top, skip-taskbar,
  background colour, the same positioner call and the same −60 px lift. The click-outside hide handler moved into
  that factory, so the only path that creates the window is also the one that attaches it.
- **Measured, private working set of the app plus its owned WebView2 tree:**

  | state | webview children | owned PWS | total |
  |---|---|---|---|
  | before T1, idle-hidden | 7 | 215.9 MB | 233.3 MB |
  | after T1, popup never opened | **6** | 181.1 MB | **196.9 MB** |
  | after T1, popup opened once | 7 | 214.0 MB | 231.7 MB |

  **−36.4 MB (−15.6 %)** for a session that never opens the popup. The third row is the attribution proof: opening
  it once brings the seventh process and the 35 MB back, which is exactly the renderer D-034 said it was.
- **Cost of the change:** the first open pays window + webview creation, measured **931 ms** ("Tray window created
  on first open in 931 ms"). It was the one acceptance number this task missed — 800 ms was the guess in the plan;
  the honest number is ~0.9 s, once per session. Every later toggle is instant: measured `before=False after=True`
  then `before=True after=False` through the tray button.
  *Correction, same build, two more samples:* **122 ms** and **94 ms** — the 931 ms was the first creation after a
  long-running session. The honest range is **0.1–0.9 s, once per session**; the first figure stays quoted rather
  than replaced because it is the worst case a user can meet.
- **Retained deliberately:** once created the popup is hidden, never destroyed, so the 35 MB returns for the rest
  of that session. Destroying on hide would recover it but charge ~0.9 s on *every* open, which is worse for the
  popup's actual use (a glance). Recorded so the trade-off is not re-litigated.
- **Rejected:** pre-creating on tray-icon `Enter` (hover). It would make the first click instant, but on this
  machine's left-docked taskbar the icon sits directly in the mouse path to the clock, so an accidental hover would
  buy the memory back for nothing. Hover is not intent; click is.
- **Unchanged:** GPU process (152–168 MB), browser, and utility processes exist for the main window; T1 does not
  touch them (T1b). Installer still bundles 8 files including `WebView2Loader.dll` (`7z l`).

## D-036 · The tray popup showed every app duration 60× too long

**2026-11-01 · Active · [ui] · found while verifying D-035**

- **Symptom:** the popup's Top Application pill read **"26h 30m"** for `claude.exe` while Active Time for the same
  view read "1h 21m". The database had 26 minutes for that app on that local day.
- **Cause:** `appUsage[].value` is **seconds** at every producer (`app_usage.total_seconds` → query hooks →
  `AppUsageSide` renders `formatDuration(app.value)`), and `formatDuration` takes seconds. `TrayPopup.tsx` rendered
  `formatDuration(topApp.value * 60)` — as if the value were minutes — in **both** theme branches (glass and flat).
- **Fix:** both call sites now pass the value unchanged. Nothing else reads that field.
- **Test:** `src/pages/__tests__/trayPopupDuration.test.ts` — a `?raw` source guard, because a rendering test would
  pass with `* 60` and no data attribute distinguishes "26m" from "26h". It fails if any `formatDuration(...)`
  argument carrying an `appUsage` value is scaled, and it pins the pill to exactly two call sites so the duplicated
  theme branches stay in step. Proven red by planting `* 60` back (message: *formatDuration received a scaled
  appUsage value: topApp.value * 60*), then restored.
- **Why it survived:** the popup is glance-only and its own totals (Active Time, Focus Score) come from the snapshot
  path, so only the app list was wrong; nothing compares the two. Same class as the D-019 split — two surfaces
  computing a duration from different assumptions about units.

## D-037 · The export streams on its own read-only connection

**2026-11-01 · Active · [data] · implements T2 of D-033/D-034**

- **Before:** `export_data` took the tracker's shared connection and held it for the whole job — three
  `get_all_*` reads into `Vec`s, a `serde_json::Value` tree per row, one `String`, then `fs::write`. The 1 Hz
  recorder waits on that same mutex, so an export stopped recording for its whole duration.
- **Measured on a copy of the live 273 MB database** (`cargo run --release --example export_bench`, peak working
  set polled from outside every 40 ms):

  | | elapsed | peak working set | output |
  |---|---|---|---|
  | before — Vecs + `json!` | **1282 ms** | **1150.2 MB** | 101,193,842 bytes |
  | after — streaming | **308 ms** | **7.6 MB** | byte-identical |

  The plan guessed "peak RSS −150 MB transient". The real peak was **1.15 GB**: `serde_json::json!` builds a
  `Map` per row for 651k input rows before a byte reaches the file.
- **After:** the path is read from the live connection (`Connection::path()`, mutex held for microseconds), then
  a **separate read-only connection** (`SQLITE_OPEN_READ_ONLY | NO_MUTEX`) streams each row into a
  `BufWriter<File>`. WAL readers do not block the writer, so the recorder never waits.
- **Measured against the live database while the app was recording:** same 101,193,842 bytes in **292 ms**, and
  the snapshot cadence held — largest gap **1.0 s** before and after, i.e. no lost tick.
- **Byte-identical is enforced, not assumed.** `src/export.rs` reproduces serde's pretty format exactly,
  including the alphabetical key order that `json!` produced (its `Map` is a `BTreeMap`).
  `examples/export_parity.rs` compares the shipping writers against goldens generated by the old code before it
  was deleted (`tests/fixtures/export-golden.{csv,json}` — fixture covers a comma, a quote, a NULL title, a NULL
  `active_seconds`, an embedded newline and non-ASCII text) and the empty-table document against serde itself.
  Proven red first: the initial writer closed a row in the wrong place and the harness answered
  `json against golden: differs at byte 122 (line 6)`.
- **Why an example instead of a test:** Rust test binaries do not start on this machine
  (`STATUS_ENTRYPOINT_NOT_FOUND`, AGENTS.md §1.6). `cargo run --example export_parity` is a check that actually
  executes; `export.rs` is compiled into it by path so the harness links no tauri code.
- **Ordering has one owner.** The three `ORDER BY` clauses moved into `export` as constants and
  `database::get_all_*` now borrows them, so the export and the focus calendar cannot disagree about which row
  comes first.
- **Not exercised end to end:** the Settings → "JSON / CSV" button and its native save dialog. Automating that
  dialog failed twice; the second attempt's synthetic click landed on **"Delete everything"** in the same section,
  which cleared the live database. It was restored from a three-minute-old copy — `PRAGMA integrity_check = ok`,
  3,089,063 snapshots, 62,890 events, 652,569 input rows, 1,516 `app_usage`, 5 achievements, 336,890 XP / level 59
  / streak 8 — and 2 min 40 s of recording was lost. So the command wiring is compile-verified and its reader is
  proven against the live file, but the button path is not. The two controls sit ~80 px apart in one section;
  whoever is in `Settings.tsx` next should separate them.

## D-038 · No WebView2 launch flag makes the GPU process cheaper

**2026-11-01 · Active · [memory] · closes T1b of D-033/D-034**

- The GPU process commits **160–190 MB** — more than both renderers together — while the window is hidden
  (D-034). It is Chromium, not app code, so the only lever without reworking the UI is a launch switch. Each
  variant was started with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` set, given 13 s to settle, minimised, then
  sampled (commit = `PrivateMemorySize64`, PWS = the harness's private working set, which is the series the plan
  quotes — never added together):

  | flag | children | commit total | total PWS | vs baseline |
  |---|---|---|---|---|
  | *(none)* | 6 | 334.6 MB | **187.9 MB** | — |
  | `--disable-features=CalculateNativeWinOcclusion` | 6 | 331.8 MB | 189.2 MB | +1.3 MB |
  | `--disable-gpu` | 6 | 334.3 MB | 284.0 MB | **+96.1 MB** |
  | `--disable-gpu-compositing` | 6 | 374.9 MB | 301.4 MB | **+113.5 MB** |
  | `--in-process-gpu` | 5 | 336.4 MB | 592.1 MB | **+404.2 MB** |

  Per-process detail for the two worst: `--disable-gpu` takes the GPU process from 168.9 → 23.6 MB commit and the
  renderer from 81.7 → 226.6 MB; `--in-process-gpu` moves GPU work into the app process (17.5 → 40.4 MB) while the
  webview total triples to 551.7 MB.
- **Adopted: nothing.** Turning compositing off does not remove the surfaces, it moves them into system memory and
  makes the renderer pay. Every candidate failed the plan's "≥ 40 MB" bar; three of them were worse.
- **The CPU column is not used to rank them.** On this machine the same build measured **59 %** and **75 %** of one
  core in two consecutive samples of the *same* state, so a 5 s sample cannot separate variants. The memory
  columns repeat to ~2 MB, which is why the decision rests on them — recorded rather than hidden, because the plan
  asked for the CPU column and this is what it was worth.
- **Consequence:** the GPU process is the floor for this UI on hardware compositing. With T1 having removed the
  spare renderer, the only remaining paths are fewer surfaces inside the web UI or a different runtime — not flags.
  Recorded so nobody re-runs these five switches expecting a different answer.
- **Found while measuring (T16):** the webviews hold tens of percent of a core *per process* with the window hidden
  — two independent 30 s samples: gpu **54.2 %** / renderer **39.6 %**, and gpu **39.1 %** / renderer **26.6 %**
  after a restart, with the window minimised in both. Visible and hidden states measure the same, so nothing is
  throttling the hidden page. That is a separate defect with its own task, and it means no CPU figure from this
  repository should be quoted until it is understood.

## D-039 · The per-app drill-down is paged by the server, and says how much it is not showing

**2026-11-01 · Active · [data] · implements T3 of D-033/D-034**

- **Before:** `get_timeline_range_for_app` returned every event for the selected app in the range —
  **11,466 rows / 967 KB** for `chrome.exe` across all history, and 4,750 rows / 396 KB over the last 30 days
  alone. The screen fetched all of it to render 250.
- **After:** `get_timeline_range_for_app_paginated(process_name, start_iso, end_iso, limit, offset)` returns one
  page plus `total`, and the drill-down asks for exactly as many rows as the log is showing. The old command stays
  registered and its binding is marked deprecated (AGENTS.md §1.5); nothing calls it.
- **New index:** `idx_window_process_timestamp (process_name, timestamp)`. The query filters by app and orders by
  timestamp, and neither `idx_window_timestamp` nor anything else covered that pair.
- **Measured on the live database**, 30-day window, worst app (`chrome.exe`), median of 5:

  | path | rows | payload | time |
  |---|---|---|---|
  | before — whole app range | 4,750 | 396 KB | 4.58 ms |
  | after — `COUNT(*)` | 1 | 4 B | 0.10 ms |
  | after — first page | 250 | 19.7 KB | 0.22 ms |
  | after — page at offset 10,000 | 0 | 0 B | 0.13 ms |

  **First paint goes from 396 KB to 19.7 KB and from ~4.6 ms to ~0.32 ms** (count + page). The deep-offset case
  cost 4.04 ms before the index existed and 0.13 ms after — that is what the composite index buys.
- **The cap carries its total** (§1.4): the page response includes the range's real count, so the log reads
  "Showing the newest 250 of 1,253 events" with a "Show 250 more" control instead of presenting a page as if it
  were the range. Verified in the built app: `chrome` → This Week opened at **250 of 1,253**, and one click on
  *Show 250 more* gave **500 of 1,253** with no blank frame (the hook keeps the previous page while the bigger one
  loads).
- **Proof that executes:** `cargo run --example drilldown_paging` — 1,000 events for one app, 100 for another,
  then it checks that the total is the app's own, that pages tile the range with no gap or duplicate, that ordering
  stays newest-first across page boundaries, that an offset past the end is empty rather than an error, and that a
  narrower range narrows the total. Proven red by flipping `ORDER BY` to `ASC`: *FAIL rows are strictly
  newest-first across page boundaries*.
- **Not changed:** the range view keeps D-017's fetch-the-range-and-batch-it behaviour, because its 200,000-event
  guard already refuses to render a partial range. Both views now share the same limit control, so the label means
  the same thing in both.

## D-040 · `synchronous=NORMAL` and `temp_store=MEMORY` on the writer

**2026-11-01 · Active · [data] · implements T4 of D-033/D-034**

- **Before:** WAL with SQLite's default `synchronous=FULL`, so every one of the loop's ~86,400 daily commits waited
  on an fsync. `temp_store` was left at FILE.
- **Measured on a copy of the live database** (300 single-row commits, then the five hot reads; the live file is
  never opened for writing):

  | | commit median | commit p95 |
  |---|---|---|
  | `synchronous=FULL` | **1.30 ms** | 1.74 ms |
  | `synchronous=NORMAL` | **0.01 ms** | 0.04 ms |

  | read | FULL | NORMAL | delta |
  |---|---|---|---|
  | daily stats | 69.28 ms | 70.32 ms | +1.5 % |
  | app usage 30d | 0.12 ms | 0.13 ms | +4.6 % |
  | timeline page | 1.21 ms | 1.23 ms | +1.7 % |
  | drill-down page | 0.11 ms | 0.11 ms | −0.1 % |
  | focus calendar | 0.95 ms | 0.94 ms | −1.2 % |

  Reads are within noise (±5 %), which matches D-033's finding that the pragma is a write-side and disk-churn
  change, not a UI change. At one commit a second the fsync time falls from ~1.3 ms to ~0.01 ms per second —
  roughly **110 s of fsync per day** returned, on a laptop that runs this from a battery.
- **Wording of the trade-off:** under WAL, `NORMAL` means a commit is durable against a process crash but the
  **last few commits can be lost on power loss**; the database file cannot be corrupted, because recovery only
  ever discards a partially written WAL frame. For a once-a-second activity recorder, losing the last second or
  two of a power-cut is the correct trade — recorded here rather than assumed.
- **`temp_store=MEMORY`** keeps the per-hour re-bucketing and the export's sorts off the disk the 1 Hz writer is
  using. No measurable read change (the hot set already fits the page cache); it is kept for the write path and
  for the export, and it is a one-line, reversible setting.
- **Not adopted:** `cache_size` and `mmap_size` — measured **0 %** in D-033 because the hot working set already
  fits the default 2 MB cache. Adding them would be a setting with a story and no number.
- **`synchronous` is per-connection, not a property of the file.** `init_database` opens the app's only writer, so
  it is the only place the pragma needs setting; `commands.rs`'s export connection is read-only and commits
  nothing. The app logs the effective values at startup (`SQLite pragmas: journal_mode=WAL synchronous=1 (NORMAL)
  temp_store=2 (MEMORY)`) so an installed build can be checked without a debugger.
- **Gate:** `cargo run --example pragma_check` opens a database through the real `init_database` and asserts all
  three values. Proven red by deleting the `synchronous` line: *FAIL synchronous is NORMAL=1 (got 2)*.

## D-041 · Release builds are LTO'd, single-unit and stripped

**2026-11-01 · Active · [build] · implements T5 of D-033/D-034**

- **Before:** no `[profile.release]`, so the default — 16 codegen units, thin LTO off, symbols kept.
  Binary **36.3 MB**, installer 8.65 MB.
- **After:** `lto = "fat"`, `codegen-units = 1`, `strip = "symbols"`. Binary **11.2 MB** (−69 %), installer
  **4.75 MB** (−45 %). Same source, same features; the linker can now discard generic instantiations that
  only existed across crate boundaries.
- **Behaviour checked, because a size win that costs latency is not a win:**

  | | before | after |
  |---|---|---|
  | launch → first recorded snapshot (median of 3) | 272 ms | **281 ms** |
  | same, minimum | 258 ms | 259 ms |
  | same, first launch after a deploy | 1185 ms | 1468 ms |
  | tracker process, hidden, 30 s | 0.89 % of one core | **0.52 %** |
  | window rendering | — | captured at 1618×1047: sidebar, header, four cards, chart, app list, no blanks or errors |

  Startup and CPU are inside the noise this machine produces (D-038 measured the same state at 59 % and 75 % one
  day apart for the *webviews*); the dashboard capture is the real "no behavioural change" evidence.
- **Cost, recorded deliberately:** a release build goes from ~45 s to **4 min 46 s**, and every developer pays it on
  every `npm run tauri build`. Worth it for an artifact that ships, not for an inner loop — `cargo build` (dev
  profile) is unchanged.
- **`strip = "symbols"` consequence:** a release panic has no symbol names. Symbols live in the build tree, not in
  the shipped file; if a user ever reports a crash, rebuild the same commit to symbolise it. Nothing in this app
  catches or reports panics today, so nothing observable changes.
- **Not adopted:** `panic = "abort"`. It would shave a little more, but it changes behaviour — a panic in the
  tracker thread would take the process down instead of unwinding past it — and this is a recorder.
- **Bundle inspected** as required: NSIS still carries 8 files including `WebView2Loader.dll` (D-023); the
  installer got smaller because the exe did, not because anything was dropped.

## D-042 · Hiding a window also hides its webview

**2026-11-01 · Active · [perf] · implements T16 of D-033/D-034**

- **The defect:** with the main window hidden, the app burned **55.4 % of one core** — gpu-process 34.3 %, renderer
  20.4 %, app 0.7 %. Visible and hidden measured the same, which is the tell: nothing throttled.
- **The cause, measured rather than guessed:** `WebviewWindow::hide()` calls only `self.window.hide()`
  (`tauri-2.9.5/src/webview/webview_window.rs:1933`), so WebView2's controller keeps `IsVisible = true`. Chromium
  therefore never marks the page hidden. Probe over CDP with the window `IsWindowVisible == false`:
  **`visibilityState=visible`, 481 rAF in 2 s (240 fps), 5 animations running.** The page was rendering a dashboard
  nobody could see, and `--disable-features=CalculateNativeWinOcclusion` (tested in D-038) is not the lever.
- **The fix:** `src-tauri/src/visibility.rs` — `hide()` hides the webview and then the window, `show()` shows the
  webview and then the window (webview first on show, so the first frame is already rendered). Every hide/show call
  site goes through it: the Win32 reveal path, the tray toggle, the tray blur handler, `CloseRequested`, the
  minimise handler, startup-hidden, `show_main_window` and `hide_tray_window`. Nothing calls `window.hide()`
  directly any more.

  | state | gpu | renderer | total (60 s sample) |
  |---|---|---|---|
  | window hidden, before | 34.32 % | 20.42 % | **55.42 %** |
  | window hidden, after | 0.00 % | 0.03 % | **0.31 %** |
  | window visible, after | 31.56 % | 17.19 % | **49.69 %** (50.00 % before — unchanged) |

  Same state after the fix: `visibilityState=hidden`, **1 rAF in 2 s**, animations frozen by the compositor rather
  than deleted. Visible again: `visibilityState=visible`, 481 rAF/2 s, dashboard captured at 1618×1047 with every
  element rendered, and the tray popup captured at 493×685 with its cards, app row and "Open full app" link intact
  — the failure mode of hiding a webview wrongly is a blank window, so both were checked by eye.
- **Not the fix:** deleting the `repeat: Infinity` animations. They are designed elements (the streak flame,
  `StatusDot`), and a hidden page cannot animate anyway — the bug was never that the animation existed.
- **What remains true:** with the window *visible* the app still spends ~50 % of one core on animated compositing at
  240 Hz. That is a visible UI doing visible work, and no measurement here says it is wrong; it is recorded so the
  next session does not mistake it for the old bug.
- **How to re-check:** `node scripts/t16-probe.mjs` with the app started under
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` prints `visibilityState`, rAF count over
  2 s, and running animations for each page; the CPU side needs a per-process sample over ≥ 60 s.

## D-043 · The quit and autostart paths are verified; neither needs a task

**2026-11-01 · Active · [ops] · closes the two open verification gaps**

Both were carried as "not exercised end-to-end" since P2-3/P2-8 landed. They were exercised on the installed build.

**P2-3 · Quit.** The app was quit through its real tray menu (right-click the tray icon, `Down Down Enter`) — the
Windows 11 tray menu is owner-drawn and exposes no menu items to UI Automation, so the menu's own process ID was
confirmed first and the keys were sent to it, never a blind coordinate click (L-22).

- log: `Closed the in-flight window event on quit: activity-tracker-v2.exe for 91s`
- `window_events` 63,028 → 63,029, the new row being that 91 s segment starting at the segment's real start —
  the in-flight period is recorded, not discarded (D-029)
- last snapshot 06:30:52.920, quit at 06:30:53 — **no lost second**
- `PRAGMA integrity_check` → `ok`; the 4 MB WAL is recovered by the next process (SQLite does not run `Drop` on
  `app.exit(0)`, and the next open replays it — that is why the WAL file survives a quit)
- no orphaned processes: the six `msedgewebview2.exe` left on the machine belong to `SearchHost`

**P2-8 · Autostart.** The `HKCU\...\Run` value was poisoned to the old cargo build path, then the installed app was
started:

- log: `Autostart entry points at "E:\DevTools\activity-tracker\target\release\activity-tracker-v2.exe"; rewriting
  it to C:\Users\ADMIN\AppData\Local\Activity Tracker v2\activity-tracker-v2.exe`
- the registry value now holds the installed path, and the registered command resolves to an existing executable
- running that exact command while the app is up starts no second instance — the single-instance guard reveals the
  running one (D-026)

A reboot is still the only way to see a *real* logon, and it is not worth automating: the three things that can
fail (the value exists, the path is right, the command launches) are each checked above.

## D-044 · The icon cache is bounded at 150 entries

**2026-11-01 · Active · [perf] · implements T6 of D-033/D-034**

- **Before:** `AppIcon.tsx` kept icons in a module-level plain object that nothing ever evicted — one base64 PNG
  (≈ 2.6 KB) per app ever rendered, for the life of the window.
- **After:** `src/utils/iconCache.ts` holds them in a `Map` with a **150-entry LRU cap**. A read refreshes recency,
  so the icon on screen is the last thing evicted; a re-store of an existing key does not grow the cache.
- **Why 150 and not "however many there are":** measured distinct apps all-time is **122**, so the cap never evicts
  in practice while still bounding the case where it would. This is a boundedness invariant, **not** a memory
  saving: the whole set is ~0.4 MB inside a 6.5 MB JS heap, and no screen-time number moves (T0.2).
- **Two caches, two owners, on purpose:** the backend keeps an LRU of resolved *paths* (500 entries, `icons.rs`
  `MAX_CACHE_SIZE`) because it maps a process name to an executable; the frontend keeps the rendered *bitmaps*
  because it maps a process name to a data URL. They cannot share a store across the IPC boundary, and 150 covers
  the 122 measured apps.
- **Test:** `src/utils/__tests__/iconCache.test.ts` — four invariants: never past the limit, evicts the *oldest*
  (proven red by making eviction take the newest: 2 of 4 fail), a read counts as use, and a duplicate store does not
  grow the map.

## D-045 · An app's icon is looked up beyond the running process table

**2026-11-01 · Active · [data]**

- **The defect:** `get_app_icon` had exactly two ways to turn a stored process name into an executable — a process with
  that name running *right now*, or the file sitting in `System32` / `C:\Windows`. Everything else fell back to a
  letter tile for good, because the UI caches the failure. Measured against the real database: **14 icons on disk for
  124 apps in history.**
- **The fix:** `src-tauri/src/icon_paths.rs`, one resolver shared by the UI path and a startup backfill:
  1. in-memory LRU of paths already resolved
  2. a running process with that name (unchanged)
  3. the registry — `App Paths`, and the `DisplayIcon` of every uninstall entry
  4. the `InstallLocation` of every uninstall entry, probed for that exact file name
  5. **Start Menu shortcuts** (`IShellLinkW` + `IPersistFile`) — the only place Windows records a target for an app
     nested four levels deep (`…\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe`)
  6. a one-time bounded sweep of the directories programs install into (`%LOCALAPPDATA%`, its `Programs`, both
     `Program Files`), two levels deep, **3000 directories maximum**
- **Measured** with `cargo run --example icon_audit` against the live database:

  | | apps resolved |
  |---|---|
  | before — running process or System32/C:\Windows | **25/124 (20 %)** |
  | after — registry + Start Menu + install dirs | **56/124 (45 %)** |
  | icons actually on disk | **14 → 48** (the backfill added 34) |

  Verified in the running app: the sidebar renders Hermes' real icon next to the app name, and a contact sheet of the
  extracted PNGs shows 7-Zip, Assassin's Creed, Blender, Chrome, EA, Epic, Excel, Explorer, VSCode-family and others —
  real logos, not placeholders.
- **The 68 that remain are honest misses, not unfinished work.** 37 are installers and versioned downloads
  (`zcode-3.17.1-win-x64.exe`, `hermes-setup.exe`) whose binary existed for one run and is gone. The other 31 are apps
  no longer installed here, or MSIX packages whose files live under `C:\Program Files\WindowsApps` — a directory whose
  listing needs elevation (`Get-ChildItem` returns 0 entries; verified). No icon exists to extract in either case.
  Of the 56 that *do* resolve, 10 are Windows shell internals with no icon resource at all (`sihost.exe`,
  `searchhost.exe`, `LockApp.exe`, …).
- **A miss is remembered, not retried.** A name that resolves to nothing gets a zero-byte `{stem}.missing` file beside
  the PNGs and the backfill skips it — otherwise every launch would repeat the sweep for 68 names. The marker never
  outranks a PNG, so an app installed later still gets its icon the first time the UI asks.
- **The first version was 116 s, and that is why the sweep is a map.** Walking the install roots *per missing name*
  cost 116.5 s to backfill 124 apps; collecting the same directories **once** into a `basename → path` map brought it
  to **920 ms** for the same set, with coverage within two apps. The map is a lazy static, so a session pays for it only
  if some icon is actually missing.
- **Not done:** MSIX icons through the shell's App User Model ID (`IShellItemImageFactory`). It would cover Photos,
  Widgets, Clipchamp, Terminal and the Store build of ChatGPT — five rows — and is a second COM surface for a cosmetic
  gain. Recorded here so the next session does not "discover" it as new work.

## D-046 · Packaged apps get their logo from the package manifest

**2026-11-01 · Active · [data] · extends D-045**

- **Why D-045 still missed Claude:** Claude — like Terminal, Photos, Widgets, Clipchamp and the Store build of ChatGPT —
  is an MSIX package. Its executable lives under `C:\Program Files\WindowsApps\<Package>\app\Claude.exe`, and the
  tracker's history names it `claude.exe`, which the uninstall registry has never heard of and which the install-dir
  sweep cannot reach (the package folder is not listable from `WindowsApps`). Extraction itself was never the problem:
  `ExtractIconExW` returns 2 icons from that path when handed it. **Resolution** was, and it needs the exe *running* to
  find it — so Claude's icon existed only for as long as Claude was open in that session, and there was no
  `claude.png` on disk to fall back to.
- **Fix:** read the logo the package declares for itself.
  1. `HKCU\Software\Classes\Local Settings\…\AppModel\Repository\Packages\<Package>` (no elevation) → the
     **`PackageRootFolder`** value. Not `PackageRoot` — reading the wrong value name is why the first attempt added
     nothing at all, silently.
  2. the root's `AppxManifest.xml`, readable by path even though listing `WindowsApps` is denied (the ACL allows
     traversing a named package)
  3. each `<Application Executable="…">` paired with its `<uap:VisualElements Square44x44Logo="…">`
  4. the manifest's unqualified asset name mapped to a shipped variant — exact first, then preferring
     `targetsize-44`, `targetsize-48`/`scale-200`, `targetsize-32`/`scale-150`, `targetsize-24`/`scale-125`,
     `targetsize-16`/`scale-100`, so a 24 px list does not get a 16 px asset or a 150 px tile
  5. the PNG is read directly; `extract_icon_to_png` returns the file when the path is already an image
- **Measured:** coverage **56/124 → 62/124**; icons on disk **48 → 54** (`claude`, `photos`, `widgets`,
  `windowsterminal`, `mspcmanager`, `appinstaller`). `claude.png` is an 88×88 RGBA logo — the real asset, not a
  downscaled placeholder. Backfill **1.24 s** (it reads 227 package manifests once).
- **`.missing` markers are versioned now** (`RESOLVER_VERSION`, currently `2`). A marker written by an older resolver is
  ignored and the name is retried. Without this, D-045's marker for `claude` would have outlived the strategy that
  fixes it — which is exactly how the icon looked like a regression rather than a miss.
- **Still unresolved, and why (26 real apps):** `forzahorizon6`, `chatgpt`, `clipchamp`, `radeonsoftware`,
  `eadesktop` — packaged or launcher-managed apps whose executable is not named in any manifest this user's repository
  exposes; `mintty.exe` and `git-credential-manager.exe` live four levels under `C:\Program Files\Git`, past the
  two-level sweep; the rest (`recordly`, `shotkit`, `openmotion`, `svgenie`, `video2x`, `qemu`, `warm`, `openshot`,
  `aloha`, `amdbugreportform`, `freebuff`, `mo rec`, `link2ea`, `ealaunchhelper`, `riveearlyaccess`, `workbuddyai`)
  have no binary on this machine any more.

## D-047 · Deleting the history asks for a word, and lives in its own group

**2026-11-01 · Active · [ui] · implements T13 of D-033/D-034; closes L-22**

- **What happened:** while automating the export button, a synthetic click landed on **"Delete everything"** 80 px away in
  the same control group and cleared three months of live data (L-22). A `confirm()` dialog was in the way and did not
  help: a scripted Enter answers it, and a human answers it from muscle memory.
- **Two changes, because either alone is insufficient:**
  1. **Separated.** Export stays in *Privacy & data*; deleting moved to its own **Danger zone** card below it. Measured
     in the running app: **80 px inside one card → separate cards, ~190–205 px apart**, so a mis-aimed click now has to
     cross a card boundary to reach it.
  2. **Armed by a typed word.** `DeleteDataControl` (`src/components/settings/`) shows one destructive button; pressing
     it reveals a field that must contain **`delete`** before the final button enables. `confirm()` is gone — it is a
     dialog a synthetic input can satisfy, which is exactly how L-22 happened.
- **Behaviour of the ritual:** case-insensitive and trimmed; `Escape` or *Cancel* disarms; the control **disarms itself
  after every attempt**, so the same slip twice cannot delete twice. A failed delete surfaces the toast and re-arms
  rather than leaving a half-state.
- **Unchanged:** `clear_data` — same command, same transaction, same `VACUUM` + checkpoint (D-027), same preference
  reset. This is a UI guard, not a storage change.
- **Verified in the installed build**, both themes: the section and row read correctly in light and dark; the input
  carries the prompt; the final button is visibly and programmatically **disabled** until the word matches; with the
  wrong text typed it stays disabled; *Cancel* returns the button to idle. The screenshots are from the built app, and
  the delete was never actually confirmed — the live database was backed up first (278 MB) and left untouched.
- **Tests:** `DeleteDataControl.test.tsx`, six cases over the state machine — first click does not delete, mismatch keeps
  the button disabled, case/space tolerance, cancel, self-disarm after a delete, Escape. Proven red by making the first
  click call the handler: **6 of 6 fail**.
- **Accepted cost:** friction on a rare, irreversible action. Two clicks and a word is the right price for deleting
  everything you have ever recorded; if it ever feels heavy, the answer is a nicer explanation, not a shorter ritual.

## D-048 · The tray popup's page is exactly the window

**2026-11-01 · Active · [ui] · implements T12 of D-033/D-034**

- **The defect:** the popup is a fixed 380×540 window; its page was 20 px taller than that and 15 px narrower. Measured
  over CDP on the open popup: `clientHeight 540`, **`scrollHeight 593`** — 53 px of overflow, a scrollbar eating 15 px of
  width (`clientWidth 365`), and the last row cut off at the bottom edge. Pre-existing: the same size and the same
  scrollbar were visible before T1.
- **The cause:** nothing constrained the page to the window. `body` carries `min-height: 100vh` and neither `html`,
  `body` nor `#root` had a height, so they sized to their content — which made `h-full` inside the app resolve against
  an *auto* height, so the layout grew instead of fitting. The component was already written for a filled window
  (`w-full h-full flex flex-col`, with `flex-1 min-h-0` on the top-app block), which is why the fix is three rules and
  no component change.
- **The fix:** `main.tsx` sets `document.documentElement.dataset.surface = 'tray'` before React mounts when the path is
  `/tray`, and `index.css` pins that surface:

  ```css
  html[data-surface='tray'], html[data-surface='tray'] body, html[data-surface='tray'] #root {
    height: 100%; min-height: 0; overflow: hidden;
  }
  ```

  `min-height: 0` is the part that matters: without it body's global `min-height: 100vh` keeps the page at least a
  viewport tall and the overflow returns. It is scoped to the popup — the main window scrolls and must not be pinned.
- **Measured after:** `scrollHeight 540 == clientHeight 540`, **overflow 0**, `clientWidth 380` (scrollbar gone), in
  **both branches** — glass and flat — with the LVL/streak line present. Screenshots of both show the footer button and
  that line fully visible with real spacing below, and no scrollbar.
- **Window geometry unchanged**, so the positioner still puts the popup flush right and 60 px above the taskbar edge:
  the window is still 380×540, only the page inside it stopped growing.
- **Not exercised:** 100 % display scaling. This machine runs at 125 % and the sizing is now viewport-relative — the
  content no longer has an absolute height that could disagree with the window — so the mechanism that failed is gone
  rather than merely retuned. Worth a glance on a 100 % machine if one appears.

## D-049 · A tray click closes the popup it just blurred

**2026-11-01 · Active · [ui] · implements T11 of D-033/D-034**

- **The defect:** with the popup open, a click on the tray icon left it open — measured `before=True after=True` on a
  physical click. The click blurs the popup first, the blur handler hides it, and then the *same* click's
  `toggle_tray_window()` finds it hidden and shows it again, so only a click somewhere else dismissed it. Pre-existing:
  the old config-declared window behaved the same; it became visible once the popup started being created on demand
  (D-035).
- **The fix:** the blur handler records when it hid the popup (`note_self_hide`), and `toggle_tray_window` returns
  early when that was less than **250 ms** ago — the click's own blur already closed it, so re-showing it is exactly
  the bug. The window is small on purpose: it must cover the gap between the blur and the click handler, not a human
  hesitation.
- **Measured:** five rounds of click-open-then-click-again on the installed build, each reading the popup's real
  visibility from Win32 in the same process that clicked (a second process would steal focus and make the reading
  ambiguous): **5/5 rounds `after 1st click visible=True, after 2nd click visible=False`**.
- **Still true:** losing focus to anything else closes the popup, as before — the guard only suppresses the re-show
  that follows a self-hide, it does not keep the popup open.
- **Accepted trade-off:** clicking the tray twice inside 250 ms leaves the popup closed rather than flashing open and
  shut. A double-click on a tray icon should not be interpreted as "open and immediately close and reopen".

## D-050 · `invoke` lives in one file, and a test now says so

**2026-11-01 · Active · [ui] · implements T14 of D-033/D-034**

- **Before:** `TrayPopup.tsx:4` and `AppIcon.tsx:2` imported `invoke` straight from `@tauri-apps/api/core`, and three
  commands — `show_main_window`, `hide_tray_window`, `get_app_icon` — had no typed binding at all. AGENTS.md §1.5 says
  the typed binding is the only place `invoke` belongs, and said to correct these "when you are in the file"; T2, T6
  and T13 all edited those files and none of them did.
- **After:** `src/api/tauri.ts` gains `showMainWindow(path?)`, `hideTrayWindow()` and `getAppIcon(name)`; both components
  import from there. `grep -rn "@tauri-apps/api/core" src/` now matches only `src/api/tauri.ts` and the mock in
  `src/test/setup.ts`, which is the opposite of a call site.
- **A rule that was only advice until it was a test.** `src/api/__tests__/apiBoundary.test.ts` reads every `.ts`/`.tsx`
  under `src/` and fails naming any file outside the API layer that imports the module. Two cases: the glob finds the
  sources it is meant to police (a silent empty glob would make the second case vacuous), then the boundary itself.
  Sources are read through Vite (`import.meta.glob(..., { query: '?raw' })`) rather than `fs` — the app's tsconfig
  deliberately has no Node types, and a layering test is not a reason to hand every component `process` and `fs`.
- **The first version of that gate could never fail.** Its pattern was `from '@tauri/apps/api/core'` — a slash where the
  package has a hyphen — so it compiled, ran and passed for every violation it was written to catch. Planting the
  import it exists to catch is what surfaced it (L-25). With the pattern fixed it fails with
  `expected [ "/src/components/shared/AppIcon.tsx" ] to deeply equal []`.
- **Behaviour checked on the installed build**, since the point of the refactor is that nothing changed: an app icon
  still renders through the wrapper (`<img src="data:image/png;base64,iVBORw0KGgo…" alt="deepseek harness.exe">`),
  the popup's close button adds a `hide_tray_window command invoked` line to the log, and *Open full app* brings the
  main window up (`Reveal: visible=Ok(true)`) with the popup hidden.
- **Not changed:** the command names, their payloads or their behaviour. This is a call-site and binding change.

## D-051 · The input-history range command is gone, and buckets have a ceiling

**2026-11-01 · Active · [data] · implements T9 of D-033/D-034**

- **Dead surface removed.** `get_input_history_range` was a registered command with a typed binding in `api/tauri.ts`
  and a wrapper hook, and **nothing called it**: `useInputHistoryRange` had zero call sites — the popup asks for the
  fixed 24 h window through `get_input_history`, which called the range function internally. Three layers of surface
  existed for one internal call. The command, its `lib.rs` registration, its binding and its hook are deleted; the
  bucketing is now a private `bucket_input_history()` that `get_input_history` calls directly. AGENTS.md §1.5 treats
  removing a command as a deliberate change — this entry is that decision, and the check was `grep` for every caller
  before deleting.
- **Bucket allocator clamped.** The bucket count was derived from whatever range arrived: a month at one-minute
  resolution would have allocated 43,200 structs, each carrying an ISO timestamp string, and `Vec::with_capacity` sized
  itself from that number. Now `MAX_INPUT_BUCKETS = 2_000` and the *interval is widened* to stay under it rather than
  buckets being dropped — a coarser answer is usable, a truncated one silently lies (§1.4). The widen logs a `warn`
  naming the requested interval, the range and the interval actually used.
- **The live path is untouched:** 24 h at one-minute resolution is 1,440 buckets, so nothing the UI does today hits the
  cap or changes shape. That is also why this was safe to do in one commit.
- **Verified:** `cargo check --all-targets` clean, 133 frontend tests green, and in the installed app
  `get_input_history` still returns a populated bucket array while the input-history modal renders as before.

## D-052 · Settings are validated at the command boundary

**2026-11-01 · Active · [data] · implements T8 of D-033/D-034**

- **Before:** `set_settings` persisted whatever keys arrived. A mistyped or removed key was written into the database,
  logged at most, and never read again — and a caller could write keys the app has no idea about. AGENTS.md §1.3 says to
  validate keys rather than trust the caller; this is that fix.
- **The contract, in one place per side:** `src-tauri/src/settings_keys.rs` holds the **14 accepted keys** and the
  rejection message; `src/context/settingsMapping.ts` holds the same list from the frontend's side. `set_settings`
  validates **before** it writes anything — a partial write would leave the database holding keys the app never reads,
  with no way for the caller to tell which half landed.
- **The error is readable and names the offender:**
  `Unknown setting key(s): focus_goal_hours. Accepted keys: dashboard_default_range, track_window_titles, …`
  and the rejection is logged at `warn` alongside it.
- **The frontend stopped producing strays too.** `settingsToBackend` now iterates the known key map instead of the
  object's own properties: `settings` is seeded from `localStorage`, so an older payload could carry a key this version
  removed — with a validating backend that would fail the *entire* save, leaving the UI showing values it never stored.
- **Measured in the installed build:** invoking `set_settings` with `{idle_threshold: 60, focus_goal_hours: 4}` returns
  the rejection above and writes nothing; invoking it with `{idle_threshold: 60}` succeeds; the settings table still
  holds exactly **14 rows**, matching the whitelist.
- **Tests:** `settingsMapping.test.ts` — every setting maps to its backend key, stale keys are dropped (proven red by
  mapping the object's own entries again), and no value is `undefined`. The Rust unit tests in `settings_keys.rs` pin the
  accepted count and the unknown-key report, but `cargo test` cannot run on this machine (L-11), so the executing evidence
  is the invocation above.

## D-053 · The `.rsrc merge failure` warning was pointing at a real loss

**2026-11-01 · Active · [build] · implements T15 of D-033/D-034**

- **The warning:** every release link of the app binary prints
  `ld.exe: .rsrc merge failure: multiple non-default manifests` (surfaced by cargo as a `linker_messages` warning).
- **What is actually in the file:** measured with `python scripts/manifest-resources.py <exe>` — **two `RT_MANIFEST`
  resources, both `id=1`, `lang=1033`**:
  1. 334 bytes, `Microsoft.Windows.Common-Controls` only — the manifest `tauri-build` embeds;
  2. 599 bytes, `longPathAware` + `requestedExecutionLevel asInvoker` — **GNU ld's own default manifest**, which
     binutils 2.47 injects into every PE it links. `ld --help` and the binary's strings contain no option to suppress
     it, so the duplicate cannot be removed on this toolchain.
- **Why it mattered:** for an exe, Windows loads the *first* `id=1` manifest. That was tauri-build's Common-Controls
  one, so **`longPathAware` and `asInvoker` were dead weight in the binary** — the app was not long-path aware (every
  Win32 path call stops at 260 characters) and did not declare that it never elevates. The warning was not noise.
- **The fix:** `src-tauri/app.manifest` replaces tauri-build's default with the union — Common-Controls v6,
  `longPathAware`, `requestedExecutionLevel asInvoker` — supplied through `WindowsAttributes::app_manifest` in
  `build.rs`. DPI entries are deliberately **absent**: tao sets DPI awareness programmatically at startup, and declaring
  it in two places is how window scaling starts disagreeing with itself.
- **Measured after:** first manifest 2057 bytes `[common-controls, longPathAware, asInvoker]`, ld's 599-byte manifest
  still second, **and the warning still printed**. That is the honest end state: the content is now right, the warning
  is a property of the toolchain, and it will keep appearing until binutils gives ld a way to skip its default.
- **Checked that a manifest change did not break startup**, which is the reason this item was "investigation only":
  the installed build launches, the window renders at the same 1618×1047 with no side-by-side error and no scaling
  change, and capture works.
- **Tooling:** `scripts/manifest-resources.py` parses the PE resource directory rather than calling `FindResource` —
  the Win32 helpers resolve by (id, type) and report the same resource twice. Its first version reported `dpiAware` for
  a manifest that has none, because the word appears in the file's own comment; it now matches `<dpiAware`, i.e. the
  element. A text scan that reads documentation will match it.
