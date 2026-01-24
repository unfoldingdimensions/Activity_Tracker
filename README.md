# Activity Tracker 🕒

A premium, privacy-first activity and productivity tracker for Windows. Built with **Tauri**, **Rust**, and **React**, this application provides deep insights into your digital habits without ever compromising your data.

## ✨ Key Features

-   **🔒 Privacy-First**: All data is stored locally in an encrypted-at-rest SQLite database. No data leaves your machine.
-   **⏱️ Real-Time Tracking**: Automatically monitors active windows and application usage with zero lag.
-   **⌨️ Input Monitoring**: Track your keystroke and mouse click volume to understand your activity intensity.
-   **📊 Dynamic Dashboards**:
    -   **The Pulse**: A high-level overview of your daily focus and screen time.
    -   **Timeline**: Chronological log of window switches and session durations.
    -   **Activity Breakdown**: Hourly analysis of productivity vs. idle time.
    -   **Energy Vampire**: AI-estimated power consumption and CPU impact of your running applications.
-   **🎨 Premium UI**: Sleek monochrome design with emerald accents, featuring glassmorphism and smooth transitions.

## 🛠️ Technology Stack

-   **Backend**: [Rust](https://www.rust-lang.org/) with [Tauri v2](https://v2.tauri.app/) for native performance and security.
-   **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/).
-   **Styling**: Custom CSS variables with a modern monochrome design system.
-   **Data Vis**: [Recharts](https://recharts.org/) for highly interactive and beautiful visualizations.
-   **Database**: [SQLite](https://sqlite.org/) via `rusqlite` for reliable local storage.
-   **Input Hooks**: `rdev` for cross-platform global input monitoring.

## 🚀 Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18+)
-   [Rust](https://www.rust-lang.org/tools/install) (latest stable)
-   Windows Build Tools (if on Windows)

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
1.  Does **not** log keystroke content (only counts).
2.  Does **not** capture screenshots.
3.  Does **not** connect to any external cloud services or telemetry.
4.  Stores everything in a local database file in your application data folder.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for focused developers.
