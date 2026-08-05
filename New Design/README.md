# Handoff: Activity Tracker — full UI revamp, two reading modes

## Overview

A complete visual and structural redesign of the Activity Tracker desktop app (Tauri + React + Tailwind, Windows). It replaces the current glassmorphism / rounded-card / gradient system with a flat, hairline-ruled, typographic system, and reorganises the app around six screens instead of a single overloaded dashboard.

Two things change structurally:

1. **A new `Tools` page.** Pomodoro, Goal Setter, Breathing and Ergonomics move off the dashboard onto their own page. This was the user's primary complaint: "the timer and other tools are hidden at the bottom."
2. **A new `Reading mode` setting with two values — `Data` (default) and `Editorial`.** Both render the _same_ queries, the _same_ tokens and the _same_ numbers. Only the presentation layer differs. `Data` leads with numbers; `Editorial` leads with a written sentence and annotates the charts in prose. It applies to Pulse, Timeline, Activity and Power. Tools and Settings are byte-identical in both modes.

Nothing was removed from the app. Every widget that exists today has a home in the new structure.

## About the design files

The files in `screens/` are **design references authored as HTML** — prototypes showing intended look, structure and behaviour. They are **not production code to copy**. Each is a self-contained `.dc.html` document that opens directly in a browser (they need the sibling `support.js`, which is included).

The task is to **recreate these designs inside the existing Activity Tracker codebase** — React 18 + TypeScript, Tailwind v4, Recharts, framer-motion, lucide-react, react-router-dom — using its established patterns:

- keep `src/pages/*.tsx` + `src/components/**` structure and the `Layout.tsx` shell,
- keep the existing hooks and data layer untouched (`useTrackerData`, `useAnalytics`, `useFocusCalendar`, `useSettings`, `useAppClassifier`, `src/api/tauri.ts`),
- keep Recharts for the line/bar/scatter charts — restyle it, don't replace it,
- **retire `GlassCard`** for these screens. The new system has no cards. Regions are separated by 1px rules on a flat background. Where a container is genuinely needed, it is a `<div>` with `border-top: 1px solid var(--border)` and padding, nothing else.

## Fidelity

**High-fidelity.** Final colours, type scale, spacing, borders and copy. Recreate pixel-accurately using the codebase's existing libraries. Every value in the Design Tokens section below is exact and taken from `src/index.css`; the three accent colours are the only additions.

Designed against a **1320 × N px** window (the app's typical width). Screens are vertically scrollable; the left rail and page header are the only fixed elements in Data mode.

---

## Design tokens

### Colour — existing, unchanged

These are already in `src/index.css`. Do not add new neutrals.

| Role                 | Light     | Dark      | CSS var              |
| -------------------- | --------- | --------- | -------------------- |
| Background           | `#faf8f5` | `#0c0a09` | `--background`       |
| Foreground           | `#1c1917` | `#fafaf9` | `--foreground`       |
| Muted foreground     | `#78716c` | `#a8a29e` | `--muted-foreground` |
| Rule / border        | `#e7e0d5` | `#292524` | `--border`           |
| Fill / hover surface | `#f5f0e8` | `#1c1917` | `--surface`          |

### Colour — accents (the whole app uses exactly three)

| Role                   | Hex                                      | Used for                                                                |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| Focus / positive       | `#0d9488` (Data) · `#0f766e` (Editorial) | focus series, positive deltas, "Deep focus", active bars, calendar ramp |
| Other / warning        | `#b45309`                                | "Other activity" series, streak, limits approaching, power draw         |
| Negative / destructive | `#9f1239`                                | negative deltas, "Clear all history"                                    |

Supporting hue, sparingly, for a _second categorical_ series only (idle bars, secondary app in a two-app split): `#6d28d9`.

**Accent rules:**

- An accent is **never** a background fill. Only: 1–2px strokes, the filled portion of a 2–3px bar, one word of text, a 9px status dot.
- Idle / inactive / empty data uses `--border` or `--muted-foreground`, never a third accent.
- Max three accents visible on one screen.
- No gradients anywhere. No glow, no `blur()`, no `box-shadow`.

### Focus-calendar ramp (grounded in `FocusCalendar.tsx`)

Keep `intensity()` exactly as it is — `0` / `<1h` / `<4h` / `<8h` / `≥8h` — and swap only the colour array:

```ts
const CELL_COLORS = [
  "bg-[color-mix(in_srgb,var(--muted-foreground)_40%,transparent)]", // none
  "bg-[rgba(13,148,136,.25)]", // < 1h
  "bg-[rgba(13,148,136,.45)]", // < 4h
  "bg-[rgba(13,148,136,.70)]", // < 8h
  "bg-[#0d9488]", // >= 8h
];
```

Cells are **9 × 9 px, `border-radius: 0`, gap 3px** (down from 15px rounded). 52 columns, rows Mon→Sun, grid ends on the current week's Sunday — all unchanged. The legend is labelled with the thresholds (`NONE · <1h · <4h · <8h · 8h+`), not "less → more".

### Typography

Two families. Both already loaded.

| Token      | Family            | Size        | Weight  | Tracking     | Used for                                                    |
| ---------- | ----------------- | ----------- | ------- | ------------ | ----------------------------------------------------------- |
| Metric     | Plus Jakarta Sans | 46px        | 600     | −0.045em     | primary KPI numbers, `font-variant-numeric: tabular-nums`   |
| Page title | Plus Jakarta Sans | 34px        | 700     | −0.035em     | "The Pulse", "Timeline"                                     |
| Sub-metric | Plus Jakarta Sans | 26–28px     | 600     | −0.04em      | secondary numbers                                           |
| Section    | Plus Jakarta Sans | 15px        | 600     | −0.02em      | section headings                                            |
| Row title  | Plus Jakarta Sans | 12.5px      | 600     | −0.01em      | app names, setting labels                                   |
| Body       | Plus Jakarta Sans | 11.5–13.5px | 400     | 0            | descriptions, `line-height: 1.65–1.75`, `text-wrap: pretty` |
| Label      | JetBrains Mono    | 9–9.5px     | 400/700 | +0.10–0.12em | ALL CAPS labels, axis ticks, timestamps                     |
| Data value | JetBrains Mono    | 10–11px     | 700     | +0.06em      | table figures, durations, percentages                       |

Unit suffixes inside a metric (`h`, `m`, `%`, `W`) are **20–24px, weight 500, `--muted-foreground`** — visibly subordinate to the digits.

**Editorial mode adds one family:** `Instrument Serif` (Google Fonts, 400 + 400 italic).

| Token           | Size                               | Used for                    |
| --------------- | ---------------------------------- | --------------------------- |
| Lede            | 44–52px, line-height 1.08, −0.02em | the opening sentence        |
| Passage heading | 20px                               | "Two sessions closed today" |
| Sidebar heading | 17px                               | "Where it went"             |
| Inline figure   | 30–46px                            | numbers set inside prose    |

### Geometry

| Token                | Value                                          |
| -------------------- | ---------------------------------------------- |
| Border radius        | **0** everywhere. No exceptions.               |
| Shadow               | none                                           |
| Rule                 | `1px solid var(--border)`                      |
| Selected tab         | `border-bottom: 1.5px solid var(--foreground)` |
| Locked / empty slot  | `1px dashed var(--border)`                     |
| Bar track height     | 2px (Editorial) / 3px (Data)                   |
| Progress/segment bar | 6–12px, square                                 |
| Status dot           | 6px circle (the only round thing in the UI)    |

### Spacing

| Context                      | Value                                                          |
| ---------------------------- | -------------------------------------------------------------- |
| Data-mode page gutter        | 32px                                                           |
| Editorial page gutter        | 44px                                                           |
| Left rail width              | 196px (Data) — Editorial has no rail, it uses a horizontal nav |
| Right sidebar                | 300px                                                          |
| Metric band padding          | `22px 32px 24px`                                               |
| Digest strip padding         | `13px 28px`                                                    |
| Section band padding         | `24px 32px 26px`                                               |
| Table row padding            | `12–13px 0`                                                    |
| Gap between sibling controls | 8–20px via `flex`/`grid` `gap` — never margins on children     |

---

## Screens

Eleven files are created. Six are the app's screens in Data mode, four are the Editorial variants, and one is the mode-switch spec.

### 1. `01-pulse-data.dc.html` — The Pulse (Data mode, DEFAULT)

**Purpose:** the always-open glance surface. Answers "am I focused right now" in under a second.

**Layout** — left rail 196px, then a vertical stack of full-bleed bands, each separated by a 1px rule:

1. **Header** `26px 32px 18px` — "The Pulse" 34/700; below it a mono line `TUE 5 AUG · 03:31 · PAST HOUR | UPDATED 4s AGO`. Right side: 6 range tabs (`Hour 6h 12h Today Week Month`) as mono 10px uppercase with a 1.5px underline on the active one; a 1px vertical divider; `3 DAY STREAK` in `#b45309`; a 26px square-bordered refresh circle.
2. **Live-session banner** — inset `0 32px`, `1px solid #0d9488`, `12px 16px`. Contents in a row: a 6px pulsing dot, "Session in progress · Code · 24m" (12.5/600), a 260px 2px progress track at 96%, `QUALIFIES AS DEEP WORK IN 1 MIN`, and `DISMISS ×` pushed right. **Only rendered while a session is open.**
3. **Metric band** — `grid-cols-4`, cells divided by 1px rules. Each: mono 9.5px uppercase label, 46px metric, then a delta line (`▲ 8% vs Mon` in `#0d9488`, `▼ 4%` in `#9f1239`) and/or an 80×16 sparkline / 2px bar. Metrics: **Screen Time 6h 42m**, **Keystrokes 12,493**, **Mouse Clicks 2,847**, **Focus Score 100%**.
4. **Digest strip** — `grid-cols-5`, mono only, `13px 28px`: Focus time `2m` · Deep sessions `2 closed` · Peak hour `03:30` · Top app `Chrome` · vs yesterday `+41m`.
5. **Main split** — `1fr / 300px`.
   - _Left:_ "Focus flow" + a 3-item legend (mono 9px; Idle shown `line-through` at 0.6 opacity when toggled off). A 250px chart: 5 horizontal rules, **no fills**, focus 1.75px solid `#0d9488`, idle 1.25px dashed `3 3` muted, other 1.25px `#b45309`, a 3px terminal dot, a 1px vertical crosshair at the hovered x, and a bordered mono tooltip (`03:18 / FOCUS 42% / OTHER 0% / IDLE 58%`). Beneath, a `grid-cols-3` KPI row divided by rules: Flow score `100 · Deep focus`, Context switches `2 · low fragmentation`, Longest streak `24 · min · 40% of 60`.
   - _Right:_ "App usage" with a `HOUR ▾` scope, two bar rows (rank 1 accent, others foreground @55%). Hovered row gets an `--surface` fill and reveals `CLICK TO FILTER THE PAGE BY THIS APP`. Below a rule: "Today's apps" as a 5-row mono list, then `DISTRACTION GUARD · CHROME 2h14 / 3h LIMIT` with an amber 2px bar at 85%.
6. **Two-up band** — _Input intensity_ (24 square cells, gap 3px, 44px tall, opacity encodes volume; hovered cell gets a 1px outline with 2px offset and its value appears in the footer) | _Work patterns_ (App diversity `5 apps`, Cognitive load `Medium` amber, Power draw `36 W · CPU 7%`, plus one explanatory sentence).
7. **Deep work sessions** — `grid-cols-3` divided by rules. Two closed sessions and the running one as the third column, its number and label in the focus accent, bar at 50% opacity.
8. **Progress footer** — `Level 7` + rank `Focused`, a 300px 3px XP bar, `4,420 / 4,900 XP · 480 TO LEVEL 8`, `3 of 6` then six 24px squares (unlocked = `1px solid var(--foreground)`, locked = `1px dashed var(--border)` + muted). Right-aligned mono keyboard hints `R REFRESH · 1–6 RANGE · T TOOLS`.

**Also included:** `01b-pulse-data-week.dc.html` — the identical page under the `Week` range, proving the layout holds: the line chart becomes 7 stacked day columns with value labels above each bar, metrics gain 7-bar spark strips, the digest switches to `Best day / vs last week`, and a full 52-week Focus Calendar band appears.

### 2. `02-timeline-data.dc.html` — Timeline

**Purpose:** the audit trail. "What was I actually doing at 14:30."

Header `Timeline` + `DETAILED ACTIVITY LOG · 10 EVENTS · TODAY`; three view tabs `All log / App wise / Sessions`; rail shows a `JUMP TO HOUR` list with per-hour event counts.

- **Focus calendar band** — the full 52×7 grid described in the tokens section, with the labelled legend and the caption `764h 14m FOCUSED IN THE LAST YEAR · 52 WEEKS` (use `formatDuration(totalFocus)`).
- **Summary strip** — `grid-cols-4` mono: Events today `10` · Tracked `6h 42m` · Longest event `52m · Code` · Redacted titles `1`.
- **The log** — one ruled table, `grid-template-columns: 88px 132px 1fr 92px 76px` = Time / App / Window title / Class / Duration. Grouped by hour: each group is preceded by a `1px solid var(--foreground)` rule and a mono caption `05 AUG 2026 · 03:00 — 3 EVENTS · 9m`. Rows are separated by `1px solid var(--border)`, hover fills `--surface`. Class is mono 9px: `FOCUS` accent, `OTHER` amber, `IGNORED` muted. Redacted titles render as italic muted `— redacted —`.
- **Footer** — `DRILL DOWN — CLICK AN APP TO FILTER THE LOG` plus five bordered app chips with day totals.

### 3. `03-activity-data.dc.html` — Activity

Header `Activity Timeline` + `ACTIVE USAGE PATTERNS THROUGHOUT THE DAY · 5 AUG`; rail exposes granularity `1 HOUR / 30 MIN / 10 MIN`.

- **Metric band** (4 cells): Active duration `317m` (`▲ 6% vs yesterday`), Idle duration `58m` (`15% of tracked time`), Peak hour `9:00` (`49m active in that hour`), Active share `85%` with a two-segment 2px bar.
- **Hourly activity breakdown** — full-width grouped columns: active `#0d9488` 22px wide, idle `#6d28d9 @50%` 14px, 42px pitch, plotted **08:00 → 23:00 only** (do not pad the axis past the last data hour).
- **Two-up:** _Activity intensity map_ — a ruled scatter, x = hour, y = intensity %, radius = duration, `#b45309 @55%` fill with a solid stroke, dashed vertical guides at 06/12/18 | _Busiest hours_ — 5 mono bar rows; _Input mix_ — keystrokes vs clicks with a derived sentence ("4.4 keystrokes per click — a typing day").
- **Footer** — a single 10px segmented ribbon of active/idle blocks: `4 BREAKS · LONGEST 22m AT 12:40`.

### 4. `04-power-data.dc.html` — Energy Vampire

Header keeps the playful name + `ESTIMATED POWER CONSUMPTION BASED ON ACTIVITY`, a live `● LIVE` marker and `SAMPLED 2s AGO`. The rail carries the honesty note: estimates come from per-app wattage bands × time, not a hardware sensor.

- **Metric band:** Avg power `36 W` + sparkline · Avg CPU est. `7%` · Screen time `6h 42m` · Energy today `238 Wh` (`▲ 12% vs yesterday`).
- **Two-up:** _Live CPU usage_ — 6 mono bar rows, name (132px) / 3px bar / percentage, refreshed every 5s | _Power impact map_ — ruled scatter, x = hours used, y = watts, radius = CPU, with inline text labels on the three largest points.
- **Top energy consumers** — ranked table `34px 190px 1fr 110px 96px 86px` = # / App / Weighted impact bar / Est. draw / Usage / Impact tag (`HIGH` rose, `MEDIUM` amber, `LOW` muted).
- **Footer** — a 34px full-width draw line with `PEAK 52W AT 14:10 · 238 Wh TODAY`.

**Arithmetic that must hold** (it is wired through every screen): per-app usage sums to screen time — Code 3.20h, Chrome 2.23h, Slack 0.68h, Terminal 0.38h, Spotify 0.20h = **6.70h = 6h 42m**. At the wattage bands already in `Power.tsx` (35 / 45 / 25 / 15 / 15 W) that is 112 + 100 + 17 + 6 + 3 = **238 Wh**, so average draw is 238 ÷ 6.70 = **36 W**. Derive these, never hard-code them independently.

### 5. `05-tools-data.dc.html` — Tools (NEW PAGE)

**Purpose:** everything you _do_, as opposed to everything you read. This is the page that fixes the buried-timer complaint. Add it to `Layout.tsx` nav between `Power` and `Settings`, with a `NEW` mono chip for the first week.

- **Header** — `Tools` + `THE FOUR THINGS YOU DO HERE, NOT THE THINGS YOU READ`; a mono status line `3 POMODOROS TODAY | 2 OF 3 TARGETS MET | BREAK DUE IN 12m`.
- **Focus timer** (`1fr / 340px` band, left) — mode tabs `Work 25 / Break 5 / Long 15`; the clock at **118px / 600 / −0.06em / tabular-nums**; beside it `WORK · SESSION 4` and three square bordered buttons `PAUSE` (foreground border) / `RESET` / `SKIP` (muted). Below: an elapsed track `25:00 — ELAPSED 6:18 — 00:00` with a 3px `#6d28d9` bar. Then a `grid-cols-4` ledger: Done today `3`, Focused `1h 15m`, Breaks taken `2`, Best streak `4`. Then eight 26×8 segments showing today against a target of 8.
- **Daily targets** (right column) — three labelled 3px bars (Code 221/240m, Chrome 154/180m tagged `LIMIT` in amber, Deep work 84/120m) and a dashed-bordered add row `APP NAME · 60 MIN · ADD`. Footer note: targets are local; limits also notify once a day and amber the tray icon.
- **Wellbeing** — three honest bars with sub-captions: Eye strain `64%` (`NEXT LOOK-AWAY IN 7 MIN`), Sedentary `48 min` amber (`STAND UP BEFORE 60 MIN`), Typing fatigue `41% load`.
- **Breathing** — `1:16` at 56px, and the **4-7-8 pattern drawn to scale** as six flex-weighted bars (4 / 7 / 8 for the current round, then the next round in `--border`), labelled `INHALE 4 · HOLD 7 · EXHALE 8`. Buttons `START` / `FULL SCREEN`. Note that it runs as an overlay and auto-fires when sedentary time crosses 60 minutes.
- **Footer** — 7-segment week strip: `17 POMODOROS · 9 BREATHING SESSIONS`.

### 6. `06-settings-data.dc.html` — Settings (identical in both modes)

A two-column ruled list. Every section is a `grid-template-columns: 232px 1fr` row: title + description on the left behind a 1px right rule, controls stacked on the right, each control row separated by a 1px rule.

Sections and controls, in order:

1. **Tracking status** — one row, square toggle, `CAPTURING WINDOW, KEYSTROKE COUNT AND CLICKS · 5s CADENCE`.
2. **General** — Launch on startup (on) · Start minimised to tray (off).
3. **Tracking behaviour** — Idle threshold as a 1px slider track with a 3×11px square handle and a mono value `120s` · Blacklisted apps as removable chips + a dashed `+ ADD APP` · Record window titles toggle · Redact these keywords chips.
4. **App classification** — a table `1fr 92px 116px 92px 30px`: App / Focus / Distraction / Ignore / remove. The active choice per row is a mono `SET` with a 1.5px underline in that column's colour (focus teal, distraction amber, ignore foreground); inactive columns show a muted `—`. Add row: dashed name field + `DISTRACTION ▾` + `ADD`.
5. **Distraction guard** — per-app daily limits as `160px 1fr 150px 30px` rows with an amber progress bar and `154 / 180 min`.
6. **Dashboard & appearance** — **Reading mode `Data | Editorial`** ← _the new setting_ · Write the summary sentence (toggle, Editorial only) · Default range (6 segmented options) · Theme (`Dark | Light | System`).
7. **Privacy & data** — Retention `30d | 90d | 180d | Forever` · Export history `JSON` / `CSV` with a record count · **Clear all activity history** in `#9f1239`, with a `1px solid #9f1239` `DELETE EVERYTHING` button. This is the only destructive-coloured element in the app.

**Toggle spec:** 34 × 16px, `1px solid` (foreground when on, border when off), 1px padding, containing a 14 × 12px block (foreground when on, border when off), justified end/start. No animation beyond a 120ms `justify-content` swap.

### 7–10. Editorial mode — `07-pulse-editorial`, `08-timeline-editorial`, `09-activity-editorial`, `10-power-editorial`

Same data, same tokens, same charts. What changes:

- **No left rail.** A horizontal nav under a serif wordmark, 44px gutters, and a `READING · EDITORIAL` mono chip in the header while the non-default mode is active.
- **The lede.** A 44–52px `Instrument Serif` sentence about the user's actual state, with the one number that matters set in the focus accent. Under it a 13.5px paragraph at `line-height: 1.75` carrying the deltas _in words_ — "41 minutes ahead of the same point yesterday", not "▲ 8%".
- **Charts gain pinned annotations.** Absolutely-positioned 11px notes with a mono timestamp, anchored to the moment they explain, plus a thin vertical rule down to the series. Two per chart, maximum.
- **Content becomes passages,** each introduced by a 20px serif heading and a sentence that states the finding before the numbers prove it: "Two sessions closed today — both started within four minutes of an idle period ending"; "Mornings are still doing the work"; "Your intensity falls off after lunch, not your presence"; "Chrome draws the most per hour, but Code costs you more today".
- **A `1fr / 300px` column pair** replaces the band grid — the narrow column holds the same tabular values Data mode shows in its strips.
- Screen-specific ledes: Pulse → the current focus run. Timeline → when the day started and how often it broke. Activity → the break pattern. Power → the draw-versus-cost trade-off, plus the estimate's limitations stated in plain language.

### 11. `11-reading-mode-spec.dc.html`

The switch itself at real size, a row-by-row diff of what each mode changes (first thing you read / type / structure / charts / deltas / best for), and the screen-by-screen mapping including the two screens that don't change.

---

## Interactions & behaviour

| Element                     | Behaviour                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nav item                    | hover fills `--surface`; active gets `border-left: 2px solid var(--foreground)` + weight 700                                                             |
| Range tabs                  | click switches range; active gets a 1.5px underline. Keys `1`–`6`.                                                                                       |
| Focus flow chart            | hover shows a 1px vertical crosshair, a 3.5px dot per series and a bordered mono tooltip; legend items toggle series (off = `line-through`, 0.6 opacity) |
| App usage row               | hover fills `--surface` and reveals the filter hint; click filters the whole page to that app                                                            |
| Intensity cell              | hover = `outline: 1px solid var(--foreground); outline-offset: 2px`; the footer caption swaps to that bucket's value                                     |
| Live session banner         | appears while a session is open; the progress bar fills toward the 25-minute deep-work threshold; `DISMISS ×` hides it for the session                   |
| Timeline group header       | click collapses the hour                                                                                                                                 |
| App chips (Timeline footer) | click filters the log; second click clears                                                                                                               |
| Toggle                      | click flips; 120ms                                                                                                                                       |
| Slider                      | drag; value updates live in mono                                                                                                                         |
| Chip `×`                    | removes the entry                                                                                                                                        |
| `DELETE EVERYTHING`         | must confirm in a second step                                                                                                                            |
| Reading mode                | switching re-renders the four reading screens; no reload, no data refetch                                                                                |
| Refresh                     | `R`; the header's "updated Ns ago" is the only always-live text in Data mode                                                                             |

**Motion budget.** The status dot pulses (`opacity 1 → .35`, `scale 1 → .82`, 2s ease-in-out, infinite). Numbers tick when their underlying value changes. Nothing else animates — no entrance transitions, no layout springs, no chart draw-on. Remove `framer-motion` entrance animations from these screens; keep the library only for the dot and value transitions.

**Loading and empty states** (to be designed if you want them explicit — not in this bundle): a metric with no data shows `—` in `--muted-foreground` at the metric size, never a spinner or a skeleton card. An empty log shows one sentence, left-aligned in the table's first column.

## State

New state, all local/persisted via the existing `useSettings`:

| Key                    | Type                                 | Default  | Notes                                                                 |
| ---------------------- | ------------------------------------ | -------- | --------------------------------------------------------------------- |
| `readingMode`          | `'data' \| 'editorial'`              | `'data'` | drives which page component renders for Pulse/Timeline/Activity/Power |
| `writeSummarySentence` | `boolean`                            | `true`   | Editorial only; off = numbers without narration                       |
| `defaultRange`         | existing                             | `'hour'` | now surfaced in Settings                                              |
| `dailyTargets`         | existing (`GoalSetter`)              | —        | moves to Tools                                                        |
| `distractionLimits`    | `{ app: string; minutes: number }[]` | `[]`     | new; notifies once per day per app                                    |

Everything else — activity rows, analytics, focus calendar, user stats, achievements, classification — comes from the hooks that already exist. **No new queries.** The Editorial ledes are derived client-side from data already fetched.

Gamification, grounded in the existing code: level curve `level = floor(sqrt(xp / 100)) + 1` (level _N_ starts at `100·(N−1)²`), so level 7 spans 3,600 → 4,900 XP; rank from `getRank()` (`Novice / Apprentice / Focused / Specialist / Master`). The six achievements and XP rewards in `Achievements.tsx` are unchanged — Early Bird 50, Night Owl 50, Deep Diver 100, Consistency King 200, Month Marathon 500, Century Club 2000 — but render as 24px bordered squares with two-letter codes rather than cards.

## Assets

None. No images, no illustrations. Icons are existing `lucide-react` glyphs at 12–20px, `stroke-width: 2`, `currentColor`, used only in the rail and the header refresh control — the content area has no icons at all.

Fonts: `Plus Jakarta Sans` and `JetBrains Mono` are already loaded. Editorial mode needs `Instrument Serif` (400 + italic) added to the Google Fonts link.

## Files

In `screens/` — open any of them directly in a browser:

| File                            | Screen                                                                    |
| ------------------------------- | ------------------------------------------------------------------------- |
| `01-pulse-data.dc.html`         | The Pulse — Data mode (the primary target)                                |
| `01b-pulse-data-week.dc.html`   | The Pulse under the Week range                                            |
| `02-timeline-data.dc.html`      | Timeline                                                                  |
| `03-activity-data.dc.html`      | Activity                                                                  |
| `04-power-data.dc.html`         | Energy Vampire                                                            |
| `05-tools-data.dc.html`         | Tools (new page)                                                          |
| `06-settings-data.dc.html`      | Settings (shared by both modes)                                           |
| `07-pulse-editorial.dc.html`    | The Pulse — Editorial mode                                                |
| `08-timeline-editorial.dc.html` | Timeline — Editorial                                                      |
| `09-activity-editorial.dc.html` | Activity — Editorial                                                      |
| `10-power-editorial.dc.html`    | Energy Vampire — Editorial                                                |
| `11-reading-mode-spec.dc.html`  | The mode switch, the diff, the mapping                                    |
| `12-design-system.dc.html`      | Type scale, both token sets, the four components, the band grid, do/don't |
| `support.js`                    | Runtime the `.dc.html` files need. Do not port.                           |

Each screen renders in **both themes** — the theme comes from the CSS custom properties set on the file's root element, so to see the other theme swap that block for the values in the token table above.

**Suggested build order:** design tokens and the `Layout.tsx` rail → `01` Pulse (Data) → `06` Settings (it contains the switch) → `05` Tools (highest user value) → `02`–`04` → then the four Editorial variants as alternate page components behind `readingMode`.
