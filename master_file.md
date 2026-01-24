# Project Master Plan: Windows Activity & Productivity Tracker

## 1. Project Overview
**Name**: Activity Tracker (Generic placeholder)
**Platform**: Windows Desktop (.exe)
**Core Value**: A privacy-first, beautiful, and "safe" activity tracker that helps users understand their digital habits through premium visualizations.
**Unique Selling Point**: Modern Glassmorphism UI combined with deep system integration that respects privacy and avoids "malware" behavior.

---

## 2. Technical Stack & Architecture

### **Core Framework: Tauri v2**
We chose **Tauri** over Electron for:
*   **Performance**: Uses the native OS WebView (WebView2 on Windows), resulting in <10MB binary size and minimal RAM usage.
*   **Safety**: Compiled Rust backend is harder to reverse-engineer and less likely to trigger heuristic AV flags than interpreted Python/Node scripts.
*   **Security**: Sandbox capability and strict IPC (Inter-Process Communication).

### **Frontend (The View)**
*   **Framework**: React 18 + TypeScript + Vite.
*   **Styling**: Tailwind CSS.
*   **Visualization**: Recharts or Nivo (SVG-based charts).
*   **State Management**: React Query (for async data fetching from Rust) + Zoning (local state).

### **Backend (The Engine)**
*   **Language**: Rust.
*   **Database**: SQLite (stored locally as `activity.db`).
*   **Polling Strategy**:
    *   **1Hz Loop**: Checks `GetForegroundWindow` explicitly.
    *   **Passive Input Monitoring**: Uses `GetLastInputInfo` to detect idle time without hooking keys (Keylogger avoidance).
    *   **Power Proxy**: Estimates power usage via Performance Counters (CPU% * Time + GPU usage).

---

## 3. Design System: "Glassmorphism & Depth"
*Adapted from the '[Master UI/UX Design System](.agent/skills/mastering-ui-design/SKILL.md)' skill.*

### **Visual Language**
*   **Theme**: Deep, dark, and translucent.
*   **Background**: Dynamic, shifting mesh gradients (Deep Blue/Purple/Zinc) or "Orb" animations.
*   **Materials**:
    *   `bg-card`: `bg-zinc-900/40 backdrop-blur-xl border-white/10`.
    *   `text`: `text-zinc-100` (Primary), `text-zinc-400` (Secondary).
*   **Typography**: `Inter` (UI) and `Plus Jakarta Sans` or `Outfit` (Headings).
*   **Interactions**:
    *   HOVER: Subtle lift and glow (`shadow-swiss-hover`).
    *   TRANSITIONS: Smooth `duration-300 ease-out`.

---

## 4. Features & Metrics

### **A. Focus Flow (The Timeline)**
*   **Metric**: Application Switching Rate + Active Window Duration.
*   **Visualization**: **Horizontal Timeline Bar**.
    *   Green Blocks: Productive Apps (Configurable).
    *   Red Blocks: Distractions.
    *   Grey Gaps: Idle/Away time.
*   **Insight**: "Fragmented Attention" identification.

### **B. Input Intensity**
*   **Metric**: Raw Input Count (Clicks/Keystrokes per minute). **NO** key contents recorded.
*   **Visualization**: **Activity Heartbeat**.
    *   Line chart overlaid on the timeline showing intensity spikes.

### **C. Context & Usage**
*   **Metric**: Window Titles (Sanitized) & Process Names.
*   **Visualization**: **Sunburst Chart**.
    *   Inner Ring: Category (Dev, Social, Media).
    *   Outer Ring: Specific App/Project (e.g., "VS Code - Project X").

### **D. Presence Patterns**
*   **Metric**: Login/Logout times, Screen On/Off events.
*   **Visualization**: **24h Heatmap**.
    *   GitHub-style contribution graph but for hours of the day.

### **E. Power Proxy (Energy Vampire)**
*   **Metric**: CPU/GPU resource usage over time per process.
*   **Visualization**: **Bubble Chart**.
    *   X-Axis: Time of Day.
    *   Y-Axis: Resource Intensity.
    *   Size: Total Impact.

---

## 5. Security & Privacy Strategy
To ensure the app is not flagged as malware:
1.  **No Hooks**: We strictly avoid `SetWindowsHookEx`. We only poll public APIs (`GetForegroundWindow`, `GetLastInputInfo`).
2.  **Local Only**: No data is ever sent to a cloud server.
3.  **Sanitization**: Logic to strictly ignore identifying sensitive window titles if possible (e.g., detecting "Password" or "Bank" in titles and redacting).

---

## 6. Implementation Roadmap

### **Phase 1: Foundation (Current)**
- [ ] Initialize Tauri + React project.
- [ ] Set up Tailwind CSS with "Glassmorphism" tokens.
- [ ] Create basic Layout Shell (Sidebar + Glass Panes).

### **Phase 2: The Mock UI**
- [ ] Implement Dashboard Home (Pulse View).
- [ ] Build "dummy" charts using Recharts to validate aesthetics.
- [ ] Refine animations and "Orb" backgrounds.

### **Phase 3: The Rust Engine**
- [ ] Implement the `Tracker` struct in Rust.
- [ ] Set up the polling loop (1Hz).
- [ ] Connect SQLite DB setup in Rust.
- [ ] Bridge Rust -> Frontend via Tauri Commands.

### **Phase 4: Polish & Packaging**
- [ ] Add Settings page (blacklist apps, adjust colors).
- [ ] Build `.exe` and test on a clean Windows VM.
