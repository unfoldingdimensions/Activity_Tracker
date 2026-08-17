# Memory measurement scripts

- `mem-snapshot.ps1` — one sample of the app's + all WebView2 processes' Private Working Set, appended to `mem-samples.csv` (auto-creates header; appends a zero row if the app isn't running).
- `mem-soak.ps1 -IntervalSeconds 30 -DurationMinutes 60` — loops snapshots for a soak period, printing a progress line per sample.

Full manual baseline procedure (checkpoints + DevTools heap snapshots): `.hermes/plans/baseline-protocol.md`.
