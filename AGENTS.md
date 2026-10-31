# AGENTS.md — Activity Tracker

Scope: this repository. Applies to any agent or human making a change here.

**Read first, in this order:** `docs/architecture.md` (layers, storage, command surface) →
`docs/flow.md` (capture tick, read paths, **metric ownership**) → `docs/decisions.md` (what is settled and
what is a known defect) → `docs/learning.md` (rules this codebase already paid for).

**Authority.** `DESIGN.md` governs design *values* — colour, type, spacing, tokens. If a rule below appears to
conflict with it, `DESIGN.md` wins on values and the conflict is **raised, not decided**. Everything else here
is binding.

**Doc discipline.** A change to behaviour, schema, a command signature or a user-visible number updates the
matching doc **in the same commit**. A stale doc is a defect. Decisions are append-only; supersede, never edit.

---

# 1 · Project rules (binding)

## 1.1 Time is two different things

- Every `timestamp` column is **UTC** ISO-8601, milliseconds, literal `Z` (`windows_api.rs:137-139`).
- `app_usage.date` is the **local** calendar date (`windows_api.rs:142-144`).
- Local day boundaries convert to a UTC range at read time; per-hour buckets are grouped in UTC then
  re-bucketed to local hours (`database.rs:302-359`, single-day only).
  Mixing the two returns empty sets with no error — that has already happened once (`useDashboardData.ts:373`).

## 1.2 One metric, one owner

`docs/flow.md` §4 is the register. Screen time comes from snapshots; time-per-app from `app_usage`; focus
score from `app_usage` × classification. If a change makes a second row of that table compute the same number
from a different source, that is a defect — pick one owner and delete the other derivation.

## 1.3 Normalise at the boundary, never downstream

- Process names are stored **lowercase** (D-021): Windows reports the casing baked into the binary, which
  split 35.9 h of history across `claude.exe` and `Claude.exe`. Identity is case-insensitive at every lookup
  — database, icon cache, classification — and display names come from `formatAppName`.
- Win32 identification failures must not become data. "Unknown" is a boundary failure wearing a value
  (`windows_api.rs:69-101`) — surface it as unattributed, do not classify it silently.
- Settings arrive as arbitrary JSON; validate keys rather than trusting the caller (`commands.rs:152`).

## 1.4 Every cap carries a truncation signal

A reader that cannot tell whether it saw everything is a defect. `get_timeline_range_paginated(…, 5000, 0)`
returns a correct page and silently drops the rest of a 30-day range (`useTimeline.ts:82-83`). New limits need
a total, a cursor, or a visible "showing N of M".

## 1.5 Adding a backend capability touches five files, in order

1. `src-tauri/src/database.rs` — the SQL, with the index it needs.
2. `src-tauri/src/commands.rs` — the command, locking state and mapping errors.
3. `src-tauri/src/lib.rs` — register it in `generate_handler!`.
4. `src/api/tauri.ts` — the typed binding (**the only place `invoke` belongs**).
5. A hook under `src/hooks/queries/` — the React Query wrapper.

Additional and non-destructive: keep the existing command, add the new one beside it. Renaming or removing a
command is a separate, deliberate change. `AppIcon.tsx:2` and `TrayPopup.tsx:4` currently bypass step 4 — do
not copy them; correct them when you are in the file.

## 1.6 Platform and toolchain facts that have bitten

- `GetModuleBaseNameW` requires `PROCESS_VM_READ`, which elevated and packaged processes refuse — a
  `PROCESS_QUERY_LIMITED_INFORMATION` handle cannot resolve a name that way. `windows_api.rs` uses
  `QueryFullProcessImageNameW` with that same limited handle; keep it that way (D-020).
- Release builds register no logger (`lib.rs:29-35`) — a write-path error is invisible in the shipped app.
  Verify against a release build before declaring a failure path fixed (`docs/learning.md` L-09).
- Gate commands: `npm run test:run`, `npm run lint`, `npm run build` (`tsc -b && vite build`). They are green
  as of 2026-10-31: 101 tests / 10 files, lint and build clean.
- **Rust tests exist but cannot run on this machine yet.** `database.rs` carries the first Rust tests
  (`#[cfg(test)]`, backfill + schema). `cargo check --all-targets` is clean, but `cargo test --lib` fails at
  **process load** with `STATUS_ENTRYPOINT_NOT_FOUND` (0xc0000139) before any test output — a GNU-toolchain
  loader problem, not an assertion failure. Until the harness loads, Rust tests are documentation: pin the
  behaviour with something that actually executes, and say which you did (`docs/learning.md` L-11).
- `@tauri-apps/*` npm packages and the `tauri` crate must stay on matching majors; builds need the
  `E:\DevTools` toolchain and the redirected cargo target.
- Capture loop = 1 Hz on one thread with one mutexed SQLite connection. Anything that holds that mutex for
  seconds (`VACUUM`, full-table export) stops recording. Estimate the stall before shipping it.
- Repo line endings are LF (`.gitattributes`/git config); Windows checkout may render CRLF. Do not let an
  editor rewrite whole files.

## 1.7 Deviations are recorded, not hidden

A rule without an escape hatch gets ignored wholesale. Break a rule only by adding a `docs/decisions.md` entry
that names the rule, the reason and the consequence — then proceed.

## 1.8 One commit per fix or feature

Every change lands as its own commit, scoped to one thing a reviewer can verify and revert alone. This is the
rule that keeps the rest of this file honest: a commit you cannot describe in one sentence is a commit nobody
can review, bisect or revert.

- **One commit = one fix or one feature**, plus its tests and the docs it invalidates. Two fixes are two
  commits. A fix plus a refactor is two commits.
- **Never mix** a behaviour change with formatting, renames, dependency bumps, or unrelated documentation.
  Those get their own commits, before or after.
- **Many files is fine when it is one feature** — a new backend command legitimately touches the five files in
  §1.5. Many files is not fine when it is two features sharing a diff.
- **Message**: Conventional Commits, imperative, ≤72 characters on the line, body explains *why* and quotes the
  measured consequence when there is one. A fix that comes out of a recon report names the finding (`P0-1`,
  `P1-4`) so the trail survives.
- **The test for the fix ships in the same commit** (§2). A fix whose test arrives later was never verified.
- **Docs go with the change**, never in a trailing "update docs" commit.
- **No half-work**: an unfinished change stays uncommitted or on a branch. Never land a fix followed by a
  "finish it" commit for the same finding.
- **Verify before committing**: `npm run test:run`, `npm run lint`, `npm run build` green, and for backend
  changes `cargo build`. State in the commit body what you ran.
- **The commit is the unit of the decision log too.** If the commit implements or supersedes a `D-0xx`, name it
  in the body.

---

# 2 · Tests must prove something

A test is a claim about behaviour that could break, and whose breaking would be silent or expensive. Anything
else is maintenance cost with no return.

**Write the test when it pins:**

- A rule that came from measured or documented platform behaviour — the API that returns `401` for a missing
  permission, the record that arrives as `400` instead of `404`, the date field that is epoch millis on one
  endpoint and ISO on another. Here that means things like: Windows reporting a process name in either case;
  `GetModuleBaseNameW` failing on an elevated handle; `app_usage` being keyed by local date while snapshots
  are keyed by UTC.
- A boundary where the wrong answer is invisible: an empty result set, a cursor the API silently ignored, an
  empty response body, a timeout that returned partial data.
- An invariant a future change could break without noticing: a write is never retried; two duplicated config
  blocks stay identical; a pure module never imports the platform.
- Arithmetic whose error is subtle: contrast ratios, attempt counts, backoff steps, page arithmetic, currency
  rounding — and here, XP/level curves, idle-vs-active seconds, bucket alignment.

**Do not write the test when it only:**

- Restates the body of the function under test.
- Covers a trivial getter, setter or formatter with no branching.
- Asserts a constant equals its own literal — unless other code depends on that literal, in which case it is a
  contract, not a constant.
- Exercises framework, browser or vendor behaviour you do not control.
- Repeats a path a behavioural test two lines up already covers, with no distinct failure mode.

**The check:** finish the sentence *"this fails if …"* with something a user would notice or a reviewer would
miss. If you cannot, delete the test.

**Two corollaries:**

- **Prove a new gate fails before trusting it.** Plant the violation, watch it fail with a readable message,
  remove it. A check never seen red is indistinguishable from one that cannot go red.
- Test count is an outcome, never a target. One sharp test beats eleven shallow ones; the shallow ones make the
  real ones slower to run and harder to find.

---

# 3 · Design pass before every commit

Walk the diff against these nine. A tripped item is fixed now, or deliberately accepted and recorded in
`docs/decisions.md` with the reason.

| Factor | What it looks like | The fix |
|---|---|---|
| **Implicit coupling** | A module keyed by a string another module must reproduce exactly (endpoint labels, storage keys, event names, message shapes). The two drift apart and nothing fails. | Give the shared thing one exported identity and have callers reference it, never retype it. Validate at the boundary so a mismatch is loud. |
| **Layer-first folders** | `lib/` accumulating one flat pile of unrelated files because "that is where helpers go". | Fine while small. Past ~5–7 files, group feature-first (`lib/export/`, `lib/render/`) instead of growing a `utils.js`. |
| **Duplication** | The same rule stated twice — two limit ranges, two copies of a config block, one fact stored in two fields. | One constant, one function, one owner. Where duplication is physically forced (JSON config, CSS media query), add a test asserting the copies are equal. |
| **Representable illegal states** | A result object where `status: 200` with `kind: 'error'` is constructible; flags that can disagree with the data they describe. | Derive one field from another instead of storing both. Make the shape per-variant: each error kind carries only the fields it needs. |
| **God files** | Any file approaching ~400 lines *(tune)*, or a file with more than one reason to change. | Split along the seam that already exists, before it becomes urgent. A test can hold the line so it fails instead of drifting. |
| **Shotgun surgery** | One conceptual change touching many files — "add an endpoint" edits five places. | Introduce the missing registry or seam so the change has one home. |
| **Layering violations** | A pure layer importing the platform (`chrome.*`, `window`, `fs`), a renderer calling the network, UI reading credentials. Mocked platforms hide this, so behavioural tests still pass. | One layer owns the platform and the network; everything below takes injected dependencies. Add a source-level check, because mocks make this invisible at runtime. |
| **Pass-through wrappers** | A function that forwards arguments to another and adds no policy. | Delete it, or give it a reason to exist: timeout, retry, logging, normalising, validation. |
| **Errors / validation not at the boundary** | Null checks scattered through renderers; the same payload shape guessed in three places; raw vendor objects flowing inward. | Validate and normalise once, at ingest: external response → internal shape at the API boundary, user input → typed value at the UI boundary. A renderer checking for `undefined` is evidence the boundary did not do its job. |

Local calibration of *(tune)* numbers: god-file line ~600 against the current worst (`Settings.tsx` 910,
`tracker.rs` 846); feature-first folders from ~6 files; the five-file backend checklist in §1.5 is this repo's
known shotgun-surgery seam — do not add a sixth step to it.

---

# 4 · Design slop indicators

The marks of generated filler. Any one makes a purpose-built tool look like a template; several together make
it look dishonest about how much thought went into it. Check the diff against this list in the same pass as §3.

| Indicator | Why it reads as generated | What to do instead |
|---|---|---|
| **Tags** | A pill or badge on every field — category, count, host, source, type — so the row becomes a row of chips. Decoration standing in for hierarchy: if everything is tagged, nothing is prioritised. | Plain text for labels and values. A pill only for state that changes and that the user acts on (running, complete, failed). Never two pills for one fact. |
| **Italicised words** | Italics as the emphasis of last resort, sprinkled through labels and helper text to make flat copy feel designed. | Weight and colour carry emphasis. Italic is reserved for quoted user content — that is data, not styling. |
| **Display serif + negative kerning** | The strongest single tell: an editorial display serif (Instrument Serif, Playfair, Fraunces) imported into a data utility, with tracking crushed to −0.03em or tighter to imitate print polish. It trades legibility for a mood the product has not earned. | One bundled, legible typeface. Heading tracking no tighter than −0.01em, body at 0. |
| **Over the top detailed UI** | Showing every computable number because it can: nine statistics, four progress readouts, a log tail. A utility is judged on the one task it exists for. | The primary surface shows state, one count, the destination, one action. Detail belongs in the report, not in the surface used while working. |
| **Dividers** | A hairline between every row and section until the surface reads as a ruled spreadsheet. | Spacing separates. A border appears only where a region genuinely ends or a card needs an edge. |
| **Multiple colour shades and opacities** | Five blues, three greys per surface, stray `rgba()` in components, tinted backgrounds that encode nothing. A palette that cannot be named is not doing work. | Status colour means exactly one thing. Everything else is a token. Opacity is for disabled state only. A genuinely new shade becomes a token before it becomes a value. |
| **Containers with borders** | Every group wrapped in a bordered box, then those boxes nested inside another. Boxes used as layout, hiding a spacing problem behind a rectangle. | One card where a group is genuinely a unit. Nesting is usually a layout problem wearing a box. |
| **Diagrams** | A diagram in the product UI: boxes and arrows describing the pipeline, the more detailed the worse. They date instantly, contradict the code within a release, and cannot be read at a glance. | If the flow cannot be told in one sentence plus a progress bar, the flow is the problem. Diagrams belong in docs — hand-drawn if anywhere — not in the product. |
| **Section numbering** | "01 — Setup", "02 — Connect": numbers nobody will cite, implying a procedure where there is only a page. | Numbered steps only when the order is mandatory, and then they are steps, not sections. |

A dense interface can look busy — that is data, and it is welcome. Busy from styling is not the same thing.

---

# 5 · Doc map

| File | Holds | Update when |
|---|---|---|
| `docs/architecture.md` | Layers, threads, schema, command surface, structural debt | A layer, table, column, index or command changes |
| `docs/flow.md` | Capture tick, read paths per screen, **metric ownership**, known distortions | A read path, metric source or capture step changes |
| `docs/decisions.md` | Numbered, dated, append-only decisions and their consequences | A decision is made, superseded, or a defect changes its status |
| `docs/learning.md` | Rule-shaped lessons: what bit us → the rule | Something bites you and the rule is not yet written |
| `DESIGN.md` | Design tokens and values (authoritative) | Any visual value changes |
| `PRODUCT.md`, `README.md` | Product intent, user-facing claims | A user-facing claim stops being true |
| `.hermes/recon/` | Recon reports and measurement artifacts | A recon pass is run |
| `.hermes/plans/` | Plans. A plan is not evidence that the work exists | — |
