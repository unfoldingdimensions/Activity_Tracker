# Activity Tracker 🕒

A premium, privacy-first activity and productivity tracker for Windows. Built with **Tauri**, **Rust**, and **React**, this application provides deep insights into your digital habits without ever compromising your data.

## ✨ Key Features

-   **🔒 Privacy-First**: All data is stored locally in an encrypted-at-rest SQLite database using WAL mode for high performance. No data leaves your machine.
-   **⏱️ Real-Time Tracking**: Automatically monitors active windows and application usage with zero-lag background monitoring.
-   **⌨️ Input Monitoring**: Track global keystroke and mouse click volume in real-time. View detailed activity heatmaps with adjustable granularity (10m, 30m, 1h).
-   **📅 Historical Analysis**: 
    -   Filter your activity records by date range: **Today**, **Yesterday**, **This Week**, **Previous Week**, and **This Month**.
    -   Switch between **Chronological Log** and **App-wise Aggregation**.
-   **🔍 Deep Dive**: Click on any application in the timeline to drill down into specific window titles and session durations for that app.
-   **📊 Dynamic Dashboards**:
    -   **The Pulse**: A high-level overview of focus scores and screen time.
    -   **Focus Flow**: A stacked visualization of productivity vs. distraction across your day.
    -   **Energy Vampire**: AI-estimated power consumption based on application intensity.
-   **🎨 Premium UI**: Sleek monochrome design with emerald accents, featuring glassmorphism, spotlight hover effects, and smooth transitions.

## 🛠️ Technology Stack

-   **Backend**: [Rust](https://www.rust-lang.org/) with [Tauri v2](https://v2.tauri.app/) for native performance.
-   **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/).
-   **Styling**: Vanilla CSS with a bespoke design system (Spotlight, Glassmorphism).
-   **Data Vis**: [Recharts](https://recharts.org/) for interactive, responsive charts.
-   **Database**: [SQLite](https://sqlite.org/) with `rusqlite` and WAL mode enabled.
-   **Input Hooks**: Global input monitoring via `rdev`.

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

4.  **Build for production**:
    ```bash
    npm run tauri build
    ```

## 🛡️ Privacy Statement

We believe your data belongs to you. This application:
1.  Does **not** log keystroke content (only frequency counts).
2.  Does **not** capture screenshots or window contents.
3.  Does **not** include any tracking pixels, telemetry, or cloud sync.
4.  Stores everything in a local `activity.db` file in your app data folder.

## 📜 License

This project is licensed under the MIT License.

---

Built with ❤️ for focused developers.
