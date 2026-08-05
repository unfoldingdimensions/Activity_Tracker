# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: the developer who built it (personal-first) — a Windows user who wants to understand their own digital habits and improve focus without surrendering privacy. Secondary audience, explicitly invited by the public open-source release: other privacy-conscious Windows users, primarily developers and knowledge workers ("Built with ❤️ for focused developers").

## Product Purpose

Activity Tracker is a Windows activity and productivity tracker that answers "where did my day actually go?" from fully local, content-free data. It tracks active window and application usage in real time, counts keystrokes/clicks without ever recording their content, estimates power draw, detects deep-work sessions, gamifies focus (XP, levels, streaks, achievements), and guards against distraction with per-app daily limits. Success means the user understands their digital habits better and can act on that understanding — not that the app is a surveillance instrument.

## Positioning

The privacy-first tracker: a native Windows app (Tauri v2) that never phones home. Where cloud trackers log content and behavior for someone else's benefit, Activity Tracker captures only counts and window titles, stores everything in a local SQLite database, and explicitly guarantees no keylog content, no screenshots, no telemetry, no cloud sync, no tracking pixels. The honest-estimate power analysis ("Energy Vampire") and the editorial reading mode that narrates your day in prose are the memorable differentiators. Open source (MIT), installable by anyone.

## Operating Context

- Windows desktop app: Tauri v2 shell with React 19 frontend in the OS WebView (WebView2), Rust backend (rusqlite, native win32 polling via GetForegroundWindow / GetLastInputInfo).
- Runs as a tray application: launch-on-startup, start-minimized-to-tray, native notifications (achievement unlocks, streak milestones, distraction-limit alerts), tray icon turns amber when a limit is crossed.
- Data lives in a machine-wide SQLite database at `C:\ProgramData\ActivityTracker` (shared across Windows user profiles on the same machine), not in the user directory.
- Single-user-per-machine product but multi-profile-tolerant by database placement; settings are machine-wide.
- Daily use: glance at The Pulse, review Timeline/Activity, check Energy Vampire, run the Tools (Pomodoro, daily targets, wellbeing, breathing).
- Dev environment quirk: no Rust toolchain on the development machine — Rust changes are code-reviewed and the user runs `cargo check` / `tauri build` themselves.

## Capabilities and Constraints

- Real-time tracking: foreground window/application monitoring (1 Hz polling), global keystroke and mouse-click counts, mouse distance, idle detection with configurable threshold.
- Historical analysis: date-range filters (Today, Yesterday, This Week, Previous Week, This Month), chronological log, app-wise aggregation, deep work sessions (contiguous focus ≥ 25 min), GitHub-style 52-week focus calendar.
- Analytics surfaces: The Pulse (focus score, screen time, daily digest with deltas vs yesterday), Focus Flow 24h timeline, activity intensity heatmap, live per-process CPU sampling, power consumption estimates from per-app wattage bands × time (clearly labeled as estimates, not hardware measurements).
- Reading modes: settings-driven `readingMode` (data | editorial) — both render the same queries and numbers; only the presentation differs (numbers-led vs. prose-led with serif narrative). Applies to Pulse, Timeline, Activity, Power; Tools and Settings are identical in both.
- Visual themes: settings-driven dark/light/system.
- Gamification: XP with level curve `level = floor(sqrt(xp/100)) + 1`, ranks (Novice → Master), streaks, six achievements with XP rewards (Early Bird 50, Night Owl 50, Deep Diver 100, Consistency King 200, Month Marathon 500, Century Club 2000).
- Distraction Guard: per-app daily time limits; one native notification per day per app, in-app alert, amber tray icon.
- Settings (machine-wide, persisted): launch on startup, start minimized to tray, idle threshold, app blacklist, per-app Focus/Distraction/Ignore classification, sensitive-title keyword redaction, data retention (30/90/180 days or forever), default range, reading mode, write-summary-sentence toggle.
- Privacy constraints (binding): never logs keystroke content (counts only), never captures screenshots or window contents, no telemetry/cloud/pixels, redacts configured sensitive keywords at record time, blacklistable apps, export (JSON/CSV) and delete-all-history at any time.
- Data export via native save dialog; destructive clear-all requires confirmation.
- Technical: TypeScript, Tailwind v4, Recharts, framer-motion, TanStack Query, react-router; tests via Vitest + React Testing Library (API path forced by mocking `isTauri`); `npm run test` / `npm run lint` / `npm run build` are the verification gates.
- Platform: Windows only (Tauri v2 / WebView2). Not mobile, not cross-platform.

## Brand Commitments

- Name: "Activity Tracker" (productName "Activity Tracker v2", identifier `com.activitytracker.app`).
- License: MIT, public repository, open-source release intended.
- Voice: premium but playful — the power page is deliberately named "Energy Vampire"; README uses light emoji and "Built with ❤️ for focused developers".
- Privacy stance as identity: "your data belongs to you" — the no-telemetry, no-content-capture guarantees are first-class product copy, not fine print.

## Evidence on Hand

- `README.md` — full feature list, privacy statement, architecture, stack, testing strategy.
- `New Design/README.md` — complete handoff spec of the current visual system and two-mode revamp (tokens, geometry, spacing, screens, interactions) with design references in `New Design/screens/`.
- `cover.png` — repository/cover art asset.
- `src/` — the implemented app (pages, components, hooks, constants); `src-tauri/` — Rust backend.
- `plans/` — analysis documents for prior issues (date-filter, memory optimization).
- No testimonials, case studies, press, or third-party usage evidence — must not be fabricated. README's Getting Started and license are the extent of outward-facing material.

## Product Principles

1. **Privacy is the product, not a feature**: no content logging, no telemetry, no cloud — every capability must survive an audit of these guarantees.
2. **Personal-first, public-second**: the app is built to serve its author's daily life; open-source users are welcome but never the primary design driver.
3. **The same truth, told two ways**: data and editorial reading modes must stay perfectly consistent — same queries, same numbers, different presentation.
4. **Explain, don't just report**: the product's job is insight (narrative summaries, deltas, honest estimates), not raw surveillance output.
5. **Native Windows citizenship**: behave like a proper Windows citizen — tray, notifications, autostart, machine-wide data — with the UI polish that makes a utility feel premium.
