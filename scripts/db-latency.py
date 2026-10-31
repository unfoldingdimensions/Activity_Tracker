#!/usr/bin/env python3
"""Time the read paths the UI actually waits on.

Phase T0.3 of the revised memory plan (D-033). Run it against the live database — every
statement here is a SELECT against a `mode=ro` connection, so the app is never blocked and
nothing is written:

    python scripts/db-latency.py
    python scripts/db-latency.py --runs 20            # more samples, steadier median
    python scripts/db-latency.py --db path\\to\\copy.db

Companion to `mem-snapshot.ps1`: that one measures the process, this one measures the
database. A change to a query, an index or a pragma must quote both before and after.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import statistics
import sys
import time

DEFAULT_DB = os.path.join(os.environ.get("ProgramData", r"C:\ProgramData"),
                          "ActivityTracker", "activity.db")

# (label, what the UI calls it, sql, params)
QUERIES = [
    (
        "daily stats (today)",
        "get_daily_stats / Dashboard cards",
        "SELECT COUNT(*) FROM activity_snapshots WHERE timestamp >= ?1 AND timestamp <= ?2 AND is_idle = 0",
        ("__today_start__", "__now__"),
    ),
    (
        "app usage (24h)",
        "get_app_usage_in_range / Activity page",
        "SELECT process_name, SUM(total_seconds) FROM app_usage WHERE date >= ?1 GROUP BY process_name",
        ("__today__",),
    ),
    (
        "timeline page (2000)",
        "get_timeline_range_paginated / Timeline list",
        "SELECT timestamp, process_name, window_title, duration_seconds, active_seconds FROM window_events "
        "WHERE timestamp >= ?1 AND timestamp <= ?2 ORDER BY timestamp DESC LIMIT 2000 OFFSET 0",
        ("__30d__", "__now__"),
    ),
    (
        "focus calendar",
        "get_all_app_usage / Focus Calendar heatmap",
        "SELECT date, process_name, total_seconds FROM app_usage ORDER BY date, total_seconds DESC",
        (),
    ),
    (
        "drill-down (worst app)",
        "get_window_events_for_process_in_range / per-app drill-down",
        "SELECT timestamp, process_name, window_title, duration_seconds, active_seconds FROM window_events "
        "WHERE process_name = ?1 ORDER BY timestamp",
        ("__top_app__",),
    ),
]


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default=DEFAULT_DB, help="database file (opened read-only)")
    ap.add_argument("--runs", type=int, default=5, help="samples per query (median reported)")
    args = ap.parse_args()

    if not os.path.exists(args.db):
        print(f"no database at {args.db}", file=sys.stderr)
        return 2

    con = sqlite3.connect(f"file:{args.db.replace(chr(92), '/')}?mode=ro", uri=True, timeout=30)
    now = time.time()
    import datetime as dt

    today = dt.datetime.now().astimezone().strftime("%Y-%m-%d")
    today_start = dt.datetime.now().astimezone().replace(hour=0, minute=0, second=0, microsecond=0)
    values = {
        "__now__": iso(dt.datetime.fromtimestamp(now, dt.timezone.utc)),
        "__today__": today,
        "__today_start__": iso(today_start.astimezone(dt.timezone.utc)),
        "__30d__": iso(dt.datetime.fromtimestamp(now - 30 * 86400, dt.timezone.utc)),
        "__top_app__": con.execute(
            "SELECT process_name FROM window_events GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 1"
        ).fetchone()[0],
    }

    print(f"database: {args.db}")
    print(f"runs per query: {args.runs}  (median reported, min in brackets)\n")
    print(f"{'query':<24}{'rows':>9}{'bytes':>10}{'median':>10}{'min':>9}   caller")

    for label, caller, sql, params in QUERIES:
        bound = tuple(values.get(p, p) for p in params)
        runs, row_count, payload = [], 0, 0
        for _ in range(max(args.runs, 1)):
            t = time.perf_counter()
            rows = con.execute(sql, bound).fetchall()
            runs.append((time.perf_counter() - t) * 1000)
            row_count = len(rows)
            payload = sum(len(str(v)) for row in rows for v in row)
        med = statistics.median(runs)
        print(f"{label:<24}{row_count:>9,}{payload:>10,}{med:>9.2f}ms{min(runs):>8.2f}ms   {caller}")

    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
