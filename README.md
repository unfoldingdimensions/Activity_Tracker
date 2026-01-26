# Activity Tracker 🕒

A premium, privacy-first activity and productivity tracker for Windows. Built with **Tauri**, **Rust**, and **React**, this application provides deep insights into your digital habits without ever compromising your data.

## ✨ Key Features

-   **🔒 Privacy-First**: All data is stored locally in an encrypted-at-rest SQLite database. On Windows, data is stored in `C:\ProgramData\ActivityTracker` to allow shared access across different user profiles on the same machine.
-   **⏱️ Real-Time Tracking**: Automatically monitors active windows and application usage with zero-lag background monitoring.
-   **⌨️ Input Monitoring**: Track global keystroke and mouse click volume in real-time. View detailed activity heatmaps with adjustable granularity (10m, 30m, 1h).
-   **📅 Historical Analysis**: 
    -   Filter your activity records by date range: **Today**, **Yesterday**, **This Week**, **Previous Week**, and **This Month**.
    -   Switch between **Chronological Log** and **App-wise Aggregation**.
-   **🔍 smart Branding**: Process names are automatically cleaned and formatted (e.g., `visual_studio_code.exe` → `Visual Studio Code`) with support for common acronyms.
-   **📊 Enhanced Visual Analytics**:
    -   **The Pulse**: A high-level overview of focus scores and screen time.
    -   **Focus Flow**: Continuous 24-hour timeline visualization with strict interval alignment (e.g., exactly starting at 5:00 AM).
    -   **Vibrant Accessibility**: A bespoke high-contrast color palette designed specifically for clarity in dark mode.
-   **🎨 Premium UI**: Sleek design featuring **Plus Jakarta Sans** typography, glassmorphism, spotlight hover effects, and smooth transitions.


## 🏗️ Architecture

This project follows a **Domain-Driven, Feature-First** architecture to ensure scalability and maintainability.

### Folder Structure
```
src/
├── api/             # Tauri backend bindings
├── components/      # UI Components
│   ├── dashboard/   # Dashboard-specific widgets
│   ├── gamification/ # Leveling, Streaks, Achievements
│   ├── insights/    # Deep analytics visualization
│   ├── tools/       # Productivity tools (Pomodoro, Goals)
│   ├── wellbeing/   # Ergonomics & Health widgets
│   ├── ui/          # Shared design system primitives (Button, Toast)
│   └── shared/      # Layout components (PageHeader, Sidebar)
├── constants/       # Design tokens, animations, config
├── context/         # React Context (Theme, etc.)
├── hooks/           # Custom React Hooks
│   └── queries/     # React Query hooks for data fetching
├── pages/           # Route components (Dashboard, Timeline, etc.)
├── types/           # Shared TypeScript definitions
└── utils/           # Helper functions (formatters, validation)
```

### Key Patterns
-   **Composition**: UI components are built using composition (e.g., `GlassCard`, `StatCard`) rather than inheritance.
-   **Data Access Layer**: All data fetching is centralized in custom hooks (`useAppUsage`, `useDailyStats`) wrapping TanStack Query for caching and state management.
-   **Error Handling**: Global and component-level `ErrorBoundaries` ensure the app never crashes completely. Visual fallbacks are provided for failed charts.
-   **Type Safety**: Full TypeScript integration with shared types mirroring Rust structs.

## 🧪 Testing Strategy

We rely on a robust testing pyramid using **Vitest** and **React Testing Library**.

-   **Unit Tests**: Validate utility functions (`src/utils/__tests__`) and custom hooks (`src/hooks/__tests__`).
-   **Component Tests**: Verify UI rendering and interaction logic for shared components.
-   **Integration Tests**: Test full page flows (`src/test/integration`) using mocked API responses.
    -   *Note*: We intentionally mock `isTauri` to force the API integration path during testing, ensuring the frontend handles data correctly.

## 🛠️ Technology Stack

-   **Backend**: [Rust](https://www.rust-lang.org/) with [Tauri v2](https://v2.tauri.app/) for native performance.
-   **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/).
-   **State Management**: [TanStack Query](https://tanstack.com/query) (React Query).
-   **Styling**: Vanilla CSS with a bespoke design system + Tailwind utility classes.
-   **Data Vis**: [Recharts](https://recharts.org/) for interactive charts.
-   **Database**: [SQLite](https://sqlite.org/) with `rusqlite`.
-   **Testing**: [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/).

## 🚀 Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18+)
-   [Rust](https://www.rust-lang.org/tools/install)
-   Windows Build Tools

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/activity-tracker.git
    cd activity-tracker
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run in development mode**:
    ```bash
    npm run tauri dev
    ```

4.  **Run tests**:
    ```bash
    npm test
    ```

5.  **Build for production**:
    ```bash
    npm run tauri build
    ```

## 🛡️ Privacy Statement

We believe your data belongs to you. This application:
1.  Does **not** log keystroke content (only frequency counts).
2.  Does **not** capture screenshots or window contents.
3.  Does **not** include any tracking pixels, telemetry, or cloud sync.
4.  Stores everything in a local `activity.db` file in the shared application data folder (`C:\ProgramData` on Windows).

## 📜 License

This project is licensed under the MIT License.

---

Built with ❤️ for focused developers.
