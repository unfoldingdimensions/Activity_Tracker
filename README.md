# Activity Tracker

[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%20%26%2011-0f766e)](https://www.microsoft.com/windows)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-24c8db)](https://v2.tauri.app/)
[![React 19](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Privacy-first Windows activity and productivity tracker.**

Activity Tracker answers the question *"where did my day actually go?"* — from fully local, content-free data. It watches the foreground window and application usage in real time, counts keystrokes and mouse clicks without ever recording their content, estimates power draw, detects deep-work sessions, gamifies focus, and guards against distraction. Everything stays on your machine.

> Your data belongs to you: no keystroke content, no screenshots, no telemetry, no cloud sync.

<p align="center">
  <img src="assets/AT_SC_1.png" alt="The Pulse dashboard — focus score, screen time, focus flow chart and app usage" width="32%"/>
  <img src="assets/AT_SC_2.png" alt="Timeline — focus calendar and per-app usage grid" width="32%"/>
  <img src="assets/AT_SC_3.png" alt="Activity — daily focus bars, input stats and GitHub-style focus calendar" width="32%"/>
</p>

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Privacy](#privacy)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Privacy-first by design** — data lives in a local SQLite database at `C:\ProgramData\ActivityTracker` (shared across Windows user profiles), never in the cloud.
- **Real-time tracking** — foreground window/app monitoring, global keystroke and click counts, mouse distance, idle detection with a configurable threshold.
- **Historical analysis** — date-range filters (Today, Yesterday, This Week, Previous Week, This Month), chronological log, app-wise aggregation, and a GitHub-style 52-week focus calendar.
- **The Pulse** — a high-level daily overview: focus score, screen time, deep-work sessions, peak hour, top app, and deltas vs. yesterday.
- **Focus Flow** — a continuous 24-hour timeline of focus intensity with strict interval alignment.
- **Deep Work Sessions** — contiguous focus blocks (≥ 25 min) with duration, dominant app, and interruptions.
- **Two reading modes** — *data* (numbers-led) or *editorial* (a serif prose narrative of your day). Same queries, same numbers, different presentation.
- **Energy Vampire** — honest power-draw estimates per app (wattage bands × time), clearly labeled as estimates, not hardware measurements.
- **Gamification** — XP, levels, streaks, and six achievements (Early Bird, Night Owl, Deep Diver, Consistency King, Month Marathon, Century Club) with native notifications on unlock.
- **Distraction Guard** — per-app daily time limits; one native notification per day, an in-app alert, and an amber tray icon when a limit is crossed.
- **Smart branding** — process names are cleaned automatically (`visual_studio_code.exe` → `Visual Studio Code`), with support for common acronyms.
- **Machine-wide settings** — launch on startup, start minimized to tray, idle threshold, app blacklist, per-app Focus/Distraction/Ignore classification, sensitive-title redaction, data retention (30/90/180 days or forever).
- **Data export** — full history as JSON or CSV via the native save dialog.
- **Premium UI** — Plus Jakarta Sans typography, glassmorphism, spotlight hover effects, dark/light/system themes, and smooth transitions.

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | [Tauri v2](https://v2.tauri.app/) (WebView2) |
| Backend | [Rust](https://www.rust-lang.org/) + `rusqlite`, native Win32 polling (`GetForegroundWindow` / `GetLastInputInfo`) |
| Frontend | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/) |
| State | [TanStack Query](https://tanstack.com/query) |
| Styling | Tailwind CSS v4 + custom design system (vanilla CSS) |
| Charts | [Recharts](https://recharts.org/) |
| Database | [SQLite](https://sqlite.org/) (bundled, via `rusqlite`) |
| Tests | [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) |

## Architecture

Domain-driven, feature-first layout — data access is centralized in React Query hooks that mirror the Rust backend's structs, so the TypeScript types and the SQLite schema never drift far apart.

```
src/
├── api/             # Tauri backend bindings
├── components/      # UI components (dashboard, insights, tools, wellbeing, ui, shared)
├── constants/       # Design tokens, animations, config
├── context/         # React Context (theme, etc.)
├── hooks/           # Custom React hooks (+ queries/ for data fetching)
├── pages/           # Route components (Dashboard, Timeline, Activity, Power, Tools, Settings)
├── types/           # Shared TypeScript definitions
└── utils/           # Helper functions (formatters, validation)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (1.77.2+)
- Windows 10 or 11 with [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)

### Installation

```bash
git clone https://github.com/unfoldingdimensions/Activity_Tracker.git
cd Activity_Tracker
npm install
```

### Run in development mode

```bash
npm run tauri dev
```

### Test, lint and build

```bash
npm test          # run the test suite (Vitest)
npm run lint      # ESLint
npm run build     # type-check + production frontend build
npm run tauri build   # full desktop installer
```

## Privacy

This application:

1. Does **not** log keystroke content — only frequency counts.
2. Does **not** capture screenshots or window contents.
3. Contains **no** tracking pixels, telemetry, or cloud sync.
4. Stores everything in a local `activity.db` under `C:\ProgramData\ActivityTracker` on Windows.
5. Can **redact window titles at record time** — sensitive keywords you configure (e.g. `password`, `bank`) are masked before anything is stored.
6. Lets you **blacklist apps** entirely and **export or delete** your data at any time.

## Contributing

Questions and bug reports are welcome via [GitHub Issues](https://github.com/unfoldingdimensions/Activity_Tracker/issues). Pull requests are reviewed and appreciated — please make sure `npm test` and `npm run lint` pass before submitting.

## License

[MIT](LICENSE) © 2026 unfoldingdimensions

---

Built for focused developers.
