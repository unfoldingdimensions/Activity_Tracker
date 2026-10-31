-- Fixture database for the export parity check (`cargo run --example export_parity`).
-- Self-contained on purpose: the harness must not need the app (or tauri) to link, and the three
-- tables below are the only ones the export reads. Rows chosen to exercise what breaks a
-- hand-written serialiser: a comma and a quote inside a process name, a NULL window title, a NULL
-- active_seconds (rows written before D-018), an embedded newline, and non-ASCII text.
-- Order matters: the export queries order app_usage by (date, total_seconds DESC), the other two
-- tables by timestamp.

CREATE TABLE window_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    process_name TEXT NOT NULL,
    window_title TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    active_seconds INTEGER
);
CREATE TABLE input_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    keystrokes INTEGER NOT NULL DEFAULT 0,
    mouse_clicks INTEGER NOT NULL DEFAULT 0,
    mouse_distance INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE app_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    process_name TEXT NOT NULL,
    total_seconds INTEGER NOT NULL DEFAULT 0,
    UNIQUE(date, process_name)
);

INSERT INTO app_usage (date, process_name, total_seconds) VALUES ('2026-10-31', 'chrome.exe', 3600);
INSERT INTO app_usage (date, process_name, total_seconds) VALUES ('2026-10-31', 'claude.exe', 1200);
INSERT INTO app_usage (date, process_name, total_seconds) VALUES ('2026-10-30', 'weird,"name".exe', 60);
INSERT INTO app_usage (date, process_name, total_seconds) VALUES ('2026-10-30', 'ünïcode-app.exe', 30);

INSERT INTO window_events (timestamp, process_name, window_title, duration_seconds, active_seconds)
    VALUES ('2026-10-31T01:02:03.000Z', 'chrome.exe', 'Title with, comma', 60, 55);
INSERT INTO window_events (timestamp, process_name, window_title, duration_seconds, active_seconds)
    VALUES ('2026-10-31T01:03:03.000Z', 'claude.exe', NULL, 120, NULL);
INSERT INTO window_events (timestamp, process_name, window_title, duration_seconds, active_seconds)
    VALUES ('2026-10-31T01:05:03.000Z', 'opera.exe', 'Line one
Line two "quoted"', 240, 200);
INSERT INTO window_events (timestamp, process_name, window_title, duration_seconds, active_seconds)
    VALUES ('2026-10-31T01:09:03.000Z', 'ünïcode.exe', '日本語のタイトル', 10, 9);

INSERT INTO input_activity (timestamp, keystrokes, mouse_clicks, mouse_distance)
    VALUES ('2026-10-31T01:02:03.000Z', 10, 2, 1500);
INSERT INTO input_activity (timestamp, keystrokes, mouse_clicks, mouse_distance)
    VALUES ('2026-10-31T01:03:03.000Z', 0, 0, 0);
