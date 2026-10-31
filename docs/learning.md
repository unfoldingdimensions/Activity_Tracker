# Learning

Rule-shaped lessons: what bit us, and the rule it produced. One rule per entry, dated, anchored to the code
that enforces it. Append; do not rewrite history. If a lesson stops being true, supersede it.

---

### L-01 · Wall-clock elapsed is not work time
**2026-10-31 · observed 2026-08-13 → 2026-10-31 · `tracker.rs:535`**
Bitten: window events close with `Instant::elapsed()` and only on process change, so an app left focused
while the machine idled absorbs the idle. Measured: 49.4% of all window-event time in the last 10 days falls
inside tracked-idle snapshots; 2026-10-28 shows 9.94 h active + 3.64 h idle producing 13.62 h of event
duration.
**Rule:** anything labelled "time in app" is measured in **active seconds counted by the capture loop**, never
by subtracting two timestamps.

### L-02 · A process name is not an app identity
**2026-10-31 · `database.rs:44-50`, `AppUsageSide.tsx:30-42`, `Activity.tsx:97`**
Bitten: Windows reports `Claude.exe` and `claude.exe` for the same binary; both are stored, so one app's time
splits in two on every screen that does not fold case. 31 of 69 days had both, 35.9 h split.
**Rule:** normalise identifiers at ingest (lowercase on write, display name from the first sighting), so no
reader has to remember to fold them.

### L-03 · Photograph the local time variation before reporting a "hole"
**2026-10-31 · analysis, no code**
Bitten: a per-local-hour profile showed hour 10:00 with exactly **zero** tracked seconds across 72 days —
which reads as a bug. Raw UTC hour counts explained it: 23:00Z carried 1,117 rows, all before the 2026-10-04
DST switch, when 23:00Z was 09:00 local instead of 10:00. The "hole" was a quiet sleep window plus one hour
of DST shift.
**Rule:** before filing a data hole, group by the raw stored value; a local-time bucket can be empty because
of the clock, not the code.

### L-04 · A resolved query window is not a resolved payload
**2026-10-31 · `useTimeline.ts:82-83`**
Bitten: `get_timeline_range_paginated(start, end, 5000, 0)` returns a *correct* page for the range and drops
the rest. Last 30 days = 20,975 events; the newest 5,000 reach back only 9.5 days. Nothing in the response
says it was truncated.
**Rule:** every cap travels with a truncation signal (a total, a cursor, or a visible "showing N of M"), and a
reader that cannot tell whether it saw everything is a defect.

### L-05 · One metric, one owner
**2026-10-31 · `useDashboardData.ts:327-344` vs `204-287`**
Bitten: the focus score reads `app_usage` (accurate) while the Focus Flow chart two inches away reads window
events (idle-inflated). Both are labelled "focus", so neither can be trusted without checking the source.
**Rule:** a user-visible number has exactly one derivation, recorded in `docs/flow.md` §4; a second
derivation is a bug even when it is prettier.

### L-06 · A silent degradation default hides a boundary failure
**2026-10-31 · `windows_api.rs:69-101`**
Bitten: `GetModuleBaseNameW` needs `PROCESS_VM_READ`, so the `PROCESS_QUERY_LIMITED_INFORMATION` fallback can
never resolve a name. Elevated and UWP windows therefore arrive as `"Unknown"` — 45.2 h, 8% of tracked time,
all silently classified as distraction.
**Rule:** when a boundary cannot identify something, say so once and loudly (a counter, a log line, an
"unattributed" bucket in the UI) instead of inventing a value that downstream code will treat as data.

### L-07 · "Approved" is a state of the plan, not of the code
**2026-10-31 · `.hermes/plans/2026-08-17_…memory-leak-review-optimization.md`**
Bitten: the plan's Open Questions are marked RESOLVED and Phases 0-5 approved; nine weeks later all nine code
items are still absent. A reader (or an agent) trusting the plan would describe work that does not exist.
**Rule:** before citing a decision log or plan, verify each claim at its `file:line`; record the result in
`docs/decisions.md` instead of assuming.

### L-08 · Reconcile aggregates against raw rows before trusting either
**2026-10-31 · analysis**
Bitten: nothing — and that is the finding worth keeping. `app_usage` sums to 554.9 h against 555.3 h of
non-idle snapshots (0.07% drift), and 333,430 XP equals exactly 10 × 33,343 active minutes. Two independent
paths agreeing is what made every other number in the analysis safe to quote.
**Rule:** declare two numbers that should agree, then check them; a single-source metric in this app is an
unverified metric.

### L-09 · Test the release profile you ship, not the one you debug
**2026-10-31 · `lib.rs:29-35`**
Bitten: logging is registered only under `cfg!(debug_assertions)`, so every `log::error!` on the write path
is a no-op in the shipped app. Debug builds look verbose and healthy; release builds fail silently.
**Rule:** an error path that only exists in debug is not an error path — first failures are reproduced
against a release build before they are declared fixed.

### L-10 · Read the toolchain gates before reading the code
**2026-10-31 · toolchain**
Bitten: nothing broken, which was worth knowing up front — 88/88 Vitest tests, eslint and `tsc -b` all clean,
and zero Rust tests. That last fact reframed every backend finding: nothing in `src-tauri/src` has a test that
could have caught it.
**Rule:** record the gate result (pass/fail/nonexistent) with a date before proposing backend changes; "no
test exists" is a finding, not a blank.

### L-11 · A test you cannot execute is a claim, not evidence
**2026-10-31 · toolchain · `src-tauri/src/database.rs`**
Bitten: the first Rust tests in this repo compile (`cargo check --all-targets` clean) but the harness dies at
process load — `STATUS_ENTRYPOINT_NOT_FOUND` (0xc0000139), before any test output, so it is the GNU-toolchain
linker/loader and not the assertions. Claiming "tests pass" would have been a fiction; deleting them would
have thrown away the invariant.
**Rule:** run a new gate once before trusting it. When it cannot run, say so in the commit, and pin the
behaviour with something that *does* execute — here the same backfill SQL replayed over an in-memory database
asserting the idle exclusion, the exclusive end boundary and idempotency.

### L-12 · A ratio without its denominator written down will be redefined by someone else
**2026-10-31 · `formatStatsForCards`, `utils/focusScore.ts`**
Bitten: "focus score" meant three things — focus-app share of classified app time, active-vs-idle clock ratio,
and 100 − context-switching penalty. The clock ratio survived only because a caller overwrote it, so it was
invisible until someone measured it; the Dashboard and the tray popup could have disagreed the day the
overwrite moved.
**Rule:** write the numerator **and** the denominator wherever a ratio is named, in the same file that computes
it. Two legitimate ratios may share a concept but never a label, and a name that has drifted across surfaces is
a defect even when every individual value is correct.

### L-13 · Changing an identifier's form breaks every cache keyed by it
**2026-10-31 · `windows_api.rs`, `icons.rs`**
Bitten: storing `process_name` lowercase fixed the split rows and would have silently deleted the icon of every
app that was not running — the icon cache is a directory of PNGs named after the process, and
`sysinfo::processes_by_name` is a case-sensitive substring match, so the fallback for a non-running app had
nothing left to look at.
**Rule:** after changing the form of an identifier, grep for every place it is used as a **key** — filenames,
caches, maps, query parameters — and make those lookups agree with the new form or migrate the keys. A data
migration is only half a migration.

### L-14 · A working write path is not a working app
**2026-10-31 · build method + verification**
Bitten: after rebuilding, `activity_snapshots` kept advancing, `active_seconds` filled, the name migration ran —
every database assertion passed — while the app window displayed `ERR_CONNECTION_REFUSED`, because
`cargo build --release` leaves `custom-protocol` disabled and the webview loads the dev server instead of the
embedded assets. Nothing failed; the user found it.
**Rule:** verify the surface the user actually sees — capture the window — before calling a UI-affecting change
done. Database evidence covers the backend only, and the two can disagree for hours without a single failing
assertion.

### L-15 · A writer-only fault never exercises a read path
Holding `BEGIN EXCLUSIVE` on the live database made every insert fail and logged `database is locked`, yet the
read paths produced **zero** warnings — the database is in WAL mode, and readers do not block on writers. The
probe looked like proof the new warning code did not work; it was proof the injection could not reach the code.
**Rule:** to test a read path, break what the read depends on — a column, a table, the schema — not the lock. And
name the failure a probe actually provoked before quoting it as evidence.

### L-16 · An `Ok` is not an effect
`window.show()` and `window.unminimize()` both returned `Ok`, and the window stayed iconic and invisible — the
code read correctly and the log said nothing, because every result went into `let _ =`. Reading the window state
back after the call is what exposed it, and the fix was the raw Win32 sequence an earlier capture had already
proved works.
**Rule:** when a call exists only for its side effect on something visible or stored, read the effect back and log
it. `Ok` means the request was accepted, not that anything changed.

### L-17 · A delete is not an erase
`DELETE` frees pages; it does not remove their bytes. In WAL mode the picture is worse: `VACUUM` writes the
rewritten database into the `-wal`, so immediately after a "clear", the main file was still 285 MB and still
held 3,627 copies of a window title the user had just been told was permanently deleted. Only
`wal_checkpoint(TRUNCATE)` made the file shrink and the bytes go.
**Rule:** when a feature's promise is about storage ("deleted", "exported", "uploaded"), verify it by reading the
bytes back, not by checking that the rows are gone from the table. And keep the expensive rewrite: an estimate
said "tens of seconds", the measurement said 0.18 s, and trusting the estimate would have shipped a worse lie.
