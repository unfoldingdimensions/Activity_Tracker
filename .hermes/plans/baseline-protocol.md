# Baseline Memory Capture Protocol — Activity Tracker v2

Phase 0 of `.hermes/plans/2026-08-17_133000-memory-leak-review-optimization.md`.
Every later optimization is judged against these numbers, so capture them on a
**release build** (`npm run tauri build`), on the machine whose process names
are confirmed below. WebView2 attribution is scoped to the app's own process
tree: each `msedgewebview2.exe` is walked up its parent chain and counted only
when an app candidate is an ancestor; any other session-wide WebView2 hosts
(SearchHost, Widgets, other WebView2 apps) are reported in the `other_*`
columns and excluded from the totals.

## Tooling

- One-shot sample:
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\mem-snapshot.ps1`
- Continuous soak:
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\mem-soak.ps1 -IntervalSeconds 30 -DurationMinutes 65`
- Rows land in `scripts\mem-samples.csv` (auto-created on first run):
  `timestamp,app_exe_name,app_pws_mb,owned_webview2_count,owned_webview2_pws_mb,total_pws_mb,other_webview2_count,other_webview2_pws_mb`
- Process names matched by the script:
  - `Activity Tracker v2` — bundled exe name (tauri.conf.json `productName`),
  - `activity-tracker-v2` — dev-build exe name (Cargo `[package]` name),
  - plus `msedgewebview2.exe` processes whose parent chain leads back to the
    app (WebView2 child processes); other WebView2 trees are reported
    separately in the `other_*` columns.
  The CSV's `app_exe_name` column records which app exe was actually found.

## Capture steps (one pass, ~55 minutes)

1. **Start the soak first.** Launch `mem-soak.ps1 -IntervalSeconds 30 -DurationMinutes 65` in a terminal and leave it running through step 8. It gives the continuous curve; the one-shot snapshots below pin exact checkpoint timestamps.
2. **Fresh boot.** Quit the app completely (tray icon → Quit, confirm no `Activity Tracker*` or `msedgewebview2` processes remain), then launch the release build.
3. **Startup + 1 min.** At 1 minute after launch (main window open on Dashboard), run one `mem-snapshot.ps1`. Note the row timestamp.
4. **Main window open, 5 min.** Stay on the Dashboard, no navigation. At 5 minutes of window-open time, run one snapshot.
5. **Tray-only, 5 min.** Close/hide the main window so only the tray icon remains (app must stay resident). After 5 minutes of tray-only, run one snapshot.
6. **Tray popup open/close ×5.** Open the tray popup, close it, repeat 5 times total (a few seconds each). Immediately after the 5th close, run one snapshot.
7. **Activity page open, 5 min.** Reopen the main window, go to the Activity page. After 5 minutes, run one snapshot.
8. **Back to Dashboard, 5 min.** Navigate back to the Dashboard. After 5 minutes, run one snapshot.
9. **Idle 30 min.** Leave the app on the Dashboard with no input for 30 minutes (no navigation, no tray interaction). Run one snapshot at the end, then stop the soak.
10. **Record.** Create `.hermes/plans/baseline-<date>.md` with the table below, pulling each checkpoint's row (by timestamp) from `scripts\mem-samples.csv`. Include min/max/avg of the idle 30-min window from the soak rows.

| Checkpoint | Timestamp | app_pws_mb | owned_webview2_count | owned_webview2_pws_mb | total_pws_mb | other_webview2_count | other_webview2_pws_mb |
|---|---|---|---|---|---|---|---|
| Startup + 1 min | | | | | |
| Main window open 5 min | | | | | |
| Tray-only 5 min | | | | | |
| Tray popup open/close ×5 | | | | | |
| Activity page 5 min | | | | | |
| Back to Dashboard 5 min | | | | | |
| Idle 30 min (end) | | | | | |
| Idle 30 min (soak min/max/avg) | | | | | |

## DevTools heap-snapshot procedure (frontend, debug build)

Use the **debug build** (`npm run tauri dev`), which enables DevTools. Goal:
measure JS-heap retention around the heavy range queries (React Query `gcTime`
is 5 min), i.e. the `useFocusCalendar` full-table fetch, per-app timeline
events, and dashboard range payloads.

1. Start `npm run tauri dev`. Wait for the main window to finish loading.
2. Open DevTools for the main webview: right-click inside the window → **Inspect** (dev mode enables the context menu; Ctrl+Shift+I works too when focus is in the webview).
3. Go to the **Memory** tab → **Heap snapshot** → take snapshot **#1** while on the **Dashboard** route. Note the "Total" retained size.
4. Navigate to the **Activity** page; stay there ≥1 minute so its queries fetch and render (heatmap + per-app lists).
5. Navigate **back to the Dashboard**.
6. **Wait 6 minutes** without navigating or interacting (this exceeds the 5-min `gcTime`, so evicted query cache entries should be collectable).
7. Take heap snapshot **#2** (same route as #1 — Dashboard).
8. In DevTools, select snapshot #2 → **Comparison** dropdown vs snapshot #1. Filter the delta list by **Retained size** and look for:
   - large retained blobs from `timelineEventsRange`, `statsRange`, `appUsageRange`, `focusCalendar` query cache entries;
   - per-event DOM nodes (GlassCard / motion.div rows) from unpaginated timeline renders;
   - base64 strings from the module-level `AppIcon` cache (many entries, 5–50 KB each).
9. Repeat the cycle 2–3 times and average the deltas; a single snapshot pair is noisy.
10. After Phases 1–3 land, repeat steps 3–8: the #1→#2 retained-size delta should drop toward zero (range-query entries evicted after `gcTime`, pagination bounding rendered nodes, icon cache capped).

Expected on the current build (pre-optimization): snapshot #2 retains a
meaningful chunk of the Activity/dashboard datasets — that is the number the
frontend fixes are measured against.
