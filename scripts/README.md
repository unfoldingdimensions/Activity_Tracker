# Memory measurement scripts

- `mem-snapshot.ps1 [-State <label>]` — one sample of the app's Private Working Set plus the WebView2 processes attributed to the app's own process tree (each `msedgewebview2.exe` is walked up its parent chain; any other session-wide WebView2 hosts land in the `other_*` columns, excluded from totals). Appends to `mem-samples.csv` (auto-creates header; appends a zero row if the app isn't running). `-State` records what the UI was doing — a memory number without its state is not comparable.
- `mem-soak.ps1 -IntervalSeconds 30 -DurationMinutes 60` — loops snapshots for a soak period, printing a progress line per sample.

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
