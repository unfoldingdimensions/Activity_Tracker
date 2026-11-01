//! The parts of Activity Tracker that are not the app: SQL, export, settings validation, icon lookup.
//!
//! Nothing here links Tauri, WebView2 or a window toolkit. That is the point: on this machine a test binary that links
//! the Tauri stack dies at process load with `STATUS_ENTRYPOINT_NOT_FOUND` (L-11), so every `#[cfg(test)]` block living
//! inside the app crate was documentation rather than a gate. Moving the logic that does not need a window into this
//! crate makes `cargo test -p activity-core` a real command, and keeps the app crate to what genuinely is Tauri
//! plumbing (D-057).
//!
//! Rule that keeps this true: nothing in this crate may import `tauri`. If a function needs an `AppHandle` to do its
//! job, it belongs in the app crate and should take the data it needs as an argument instead.

pub mod database;
pub mod export;
pub mod icon_cache;
pub mod icon_paths;
pub mod settings_keys;
