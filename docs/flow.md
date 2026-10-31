# Flow

> Verified against commit `f51775a` on 2026-10-31. Update in the same commit as the code.
> §4 (metric ownership) and §7 (known distortions) are the two sections to read before changing a read path.

## 1. Capture — one tick, once per second

Order matters: each step below depends on state read earlier in the same tick (`tracker.rs:435-704`).

1. **Stop check** — `is_running` false → break out of the loop (`tracker.rs:437-443`).
2. **Idle** — `GetLastInputInfo` → seconds since last input (`windows_api.rs:106-128`); `is_idle = idle_seconds > idle_threshold` (default 60 s, user-settable).
3. **Settings snapshot** — idle threshold, blacklist and redaction keywords are read from the in-memory cache, never from SQL (`tracker.rs:449-464`).
4. **Foreground window** — `GetForegroundWindow` → title (`GetWindowTextW`) + process name (`GetModuleBaseNameW`) (`windows_api.rs:27-56`).
5. **Publish current window** to `Tracker::current_window` with the title already redacted (`tracker.rs:474-481`).
6. **Drain input counters** — keystrokes / clicks / mouse distance accumulated since the last tick (`tracker.rs:484`).
7. **Write, holding the DB mutex once** (`tracker.rs:492-683`):
   - `activity_snapshots` — always, 1 row per tick.
   - `input_activity` — only when keystrokes or clicks > 0.
   - `app_usage` — `+1 s` for the foreground process, **only when not idle and not blacklisted**.
   - `window_events` — written **only when the process changes**: the previous period is closed with `duration = app_start_time.elapsed()` and a back-dated start timestamp (`tracker.rs:532-555`).
   - Gamification (only when not idle): achievements, `+10 XP` per 60 active seconds, level, streak.
8. **Distraction guard** — at most once a minute, compare today's `app_usage` against `app_limits`; one native notification per app per day, an in-app event, and an amber tray icon (`tracker.rs:57-132`, `686-691`).
9. **Tray reset** — at local day change, restore the default tray icon.
10. **Sleep 1 s.**

Two consequences that follow directly from step 7 and are tracked as defects, not as design:
`app_usage` counts **active** seconds while `window_events` duration measures **wall clock**, so an idle
stretch inside one app inflates that event; and when tracking stops or the app quits, the open event is
never closed, so the tail of the session is lost.

## 2. Read paths — Today vs Range

The dashboard branches once, in `src/hooks/useDashboardData.ts:43-140`, and the two branches must not be
confused when changing anything.

**Today** (`isToday`): `get_daily_stats` (snapshots), `get_app_usage` (`app_usage` for the local date),
`get_activity_timeline` (per-hour local buckets). No window events are required *unless* the range-events
query returns rows, which takes priority for the chart.

**Any other range**:
- `get_stats_range` → screen time / keystrokes / clicks, counted directly off `activity_snapshots` and
  `input_activity` for a UTC range (accurate at any length).
- `get_app_usage_range` → per-process seconds from `app_usage`, local date keys.
- `get_timeline_range_paginated` → window events, **capped at 5,000 rows ordered newest-first**
  (`src/hooks/queries/useTimeline.ts:82-83`). This is the current P0: a 30-day range holds ~21k events, so
  the oldest ~20 days of every event-derived number are missing.
- `get_timeline_range_for_app` → drill-down, exact `process_name` match, no limit.

Sub-day ranges (past 1 h / 6 h / 12 h) compute app usage **client-side** by overlapping window events with
the range (`useDashboardData.ts:184-193`) — so they inherit the window-event distortions entirely.

**Screens and their inputs**

| Screen | Route | Reads | Derives |
|---|---|---|---|
| The Pulse (Dashboard) | `/` | daily stats or range stats, app usage, window events | focus score, focus flow, deep-work sessions, digest, deltas |
| Timeline | `/timeline` | window events (paginated), app usage range | chronological log, per-day grid, per-app drill-down |
| Activity | `/activity` | `get_app_usage`, input history, `get_all_app_usage` (calendar) | daily bars, input stats, focus calendar |
| Power | `/power` | `app_usage` + live CPU snapshot (+ mock fallback outside Tauri) | per-app watt estimates, live load |
| Tools | `/tools` | settings, app usage, wellbeing hooks | local timers (targets, breaks, pomodoros), breathing |
| Settings | `/settings` | `get_settings` / `set_settings`, export, clear | configuration |
| Tray popup | `/tray` | `get_daily_stats`, active window, `is_tracking` | today at a glance |

## 3. Settings flow

Read: `get_settings` → the tracker's in-memory cache (`commands.rs:142-148`); the frontend merges defaults,
so the backend only ever returns explicitly stored keys.
Write: `set_settings` → persist each key to the `settings` table, then `apply_setting` on the live cache
(`commands.rs:152-178`). Anything the loop reads per tick (idle threshold, blacklist, redaction keywords,
retention) is therefore live within one second; nothing requires a restart except process-level settings
(autostart, start-minimised) handled by their plugins.

## 4. Metric ownership — binding

| User-visible number | Single source of truth | Computed in |
|---|---|---|
| Screen time / active time | `activity_snapshots` where `is_idle = 0` | `database.rs:228-239`, `273-284` |
| Idle time | `activity_snapshots` where `is_idle = 1` | same |
| Keystrokes / clicks / distance | `input_activity` sums | `database.rs:242-250` |
| Time per app (day or range) | `app_usage.total_seconds` | `database.rs:206-216`, `440-454` |
| Focus score | `app_usage` seconds × `classifyApp` | `useDashboardData.ts:327-344` |
| Focus Flow chart | window events × `classifyApp` | `useDashboardData.ts:204-287` |
| Deep-work sessions | window events | `utils/focusSessions.ts` |
| Timeline rows and durations | window events | `pages/Timeline.tsx` |
| Focus calendar (52 weeks) | `get_all_app_usage` → per-day sums | `hooks/useFocusCalendar.ts` |
| XP / level / streak | `user_stats` | `tracker.rs:622-681`, `formatters.ts:217-227` |

**Rule:** if a change makes two rows of this table compute the same number from different sources, that is a
defect under `AGENTS.md` §3 (duplication) — pick one owner and delete the other derivation.

## 5. Gamification and limits

- XP: 10 per 60 active seconds → level = `floor(sqrt(xp/100)) + 1`; the frontend mirrors the curve in
  `formatters.ts:217-227`. Measured 2026-10-31: 333,430 XP == exactly 10 × 33,343 active minutes.
- Streak: evaluated at most once per local day, inside the not-idle branch; a non-consecutive date resets it to 1.
- Achievements: `INSERT OR IGNORE` on `code`, so a re-evaluation is idempotent; a first insert awards bonus XP.
- Distraction guard: app limits are substring matches on lowercase process names, checked once a minute,
  deduped per app per day.

## 6. Retention, export, clear

- **Retention**: cleanup thread runs every 24 h and deletes snapshots, input rows and window events older than
  `retention_days` (`tracker.rs:396-427`). `0` means keep forever — the current setting — so nothing is ever
  deleted and the file grows monotonically (~3.6 MB/day measured). `app_usage` is never pruned.
- **Export**: `export_data` reads all three event tables into memory and writes CSV (three sections) or JSON
  to a path chosen by the native dialog (`commands.rs:61-114`). Unbounded by design.
- **Clear**: `clear_data` deletes all activity rows, resets `user_stats`, runs `VACUUM`, and removes the icon
  cache directory (`commands.rs:441-461`, `database.rs:604-616`).

## 7. Known distortions (read before trusting a screenshot)

| # | Distortion | Reaches | Ref |
|---|---|---|---|
| P0 | Range events capped at 5,000 newest → old part of any long range renders empty | Focus Flow, deep work, digest on This Month | `useTimeline.ts:82-83` |
| P1 | Wall-clock duration includes idle → focus surfaces overstate by the idle share (measured 49.4% of event time) | Focus Flow, deep work, Timeline, sub-day app split | `tracker.rs:535` |
| P1 | Unresolved process → `"Unknown"`, classified as distraction (45.2 h measured) | Focus score, top-app list | `windows_api.rs:69-101`, `appClassification.ts:46` |
| P1 | `Claude.exe` vs `claude.exe` split; merged only in the dashboard sidebar | Activity page rows, Timeline drill-down | `AppUsageSide.tsx:30-42` vs `Activity.tsx:97` |
