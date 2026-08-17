# Memory measurement scripts

- `mem-snapshot.ps1` — one sample of the app's Private Working Set plus the WebView2 processes attributed to the app's own process tree (each `msedgewebview2.exe` is walked up its parent chain; any other session-wide WebView2 hosts land in the `other_*` columns, excluded from totals). Appends to `mem-samples.csv` (auto-creates header; appends a zero row if the app isn't running).
- `mem-soak.ps1 -IntervalSeconds 30 -DurationMinutes 60` — loops snapshots for a soak period, printing a progress line per sample.

Full manual baseline procedure (checkpoints + DevTools heap snapshots): `.hermes/plans/baseline-protocol.md`.
