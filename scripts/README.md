# Memory measurement scripts

- `mem-snapshot.ps1 [-State <label>]` — one sample of the app's Private Working Set plus the WebView2 processes attributed to the app's own process tree (each `msedgewebview2.exe` is walked up its parent chain; any other session-wide WebView2 hosts land in the `other_*` columns, excluded from totals). Appends to `mem-samples.csv` (auto-creates header; appends a zero row if the app isn't running). `-State` records what the UI was doing — a memory number without its state is not comparable.
- `mem-soak.ps1 -IntervalSeconds 30 -DurationMinutes 60` — loops snapshots for a soak period, printing a progress line per sample.
- `db-latency.py [--runs N] [--db path]` — times the five read paths the UI waits on (`daily stats`, `app usage`, `timeline page`, `focus calendar`, `drill-down`) over a read-only connection, reporting rows, payload bytes and median/min ms. It never writes and never blocks the app's writer.
- `webview-heap.mjs [--port 9222] [--sample-ms 3000] [--json]` — per-renderer attribution over CDP: JS heap used/committed, DOM nodes and listeners, and the biggest sampled allocators. Needs the app started once with a debugging port (no code change):

  ```powershell
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
  Start-Process "$env:LOCALAPPDATA\Activity Tracker v2\activity-tracker-v2.exe"
  node scripts/webview-heap.mjs --sample-ms 6000
  ```

  Every target's URL names its window (`/` main, `/tray` popup, `/timeline` …), which is how the two renderers are told apart. **Unset the variable and restart afterwards** — the debug port is open to any local process while the app runs.

- `t16-probe.mjs [--port 9222]` — the same debug port, asking a different question: for each page it prints `document.visibilityState`, how many `requestAnimationFrame` callbacks land in 2 s, and how many animations are still running. A hidden window that reports `visible` with ~480 frames is rendering for nobody (D-042). The counter is installed, waited on outside the page, then read back — awaiting a rAF promise inside a hidden page never resolves, which is the result, not a bug.

Full manual baseline procedure (checkpoints + DevTools heap snapshots): `.hermes/plans/baseline-protocol.md`.

## Baseline protocol (three states, one row each)

A single memory number for this app means nothing: the two webviews dominate, and their footprint depends on whether
a window is rendered and how much data it holds. Capture all three:

```powershell
# 1. window hidden / minimised to tray — the state the app spends most of its life in
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\mem-snapshot.ps1 -State idle-hidden

# 2. Dashboard visible and polling (reveal the window: launching the exe again fronts it)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\mem-snapshot.ps1 -State dashboard-visible

# 3. Timeline visible, holding a full range of events
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\mem-snapshot.ps1 -State timeline-visible
```

Rows append to `mem-samples.csv` (`state` is the second column). That file is gitignored: quote the numbers in the
decision or plan that consumes them rather than committing the data.
