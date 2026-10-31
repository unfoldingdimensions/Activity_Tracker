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
**2026-08-13 · Under review · [code]** `lib.rs:29-35`
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
**2026-08-13 · Active · [code]** `database.rs:232-291`
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
