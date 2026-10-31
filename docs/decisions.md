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
**2026-08-17 · Open · [plan] `.hermes/plans/2026-08-17_133000-memory-leak-review-optimization.md`**
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
