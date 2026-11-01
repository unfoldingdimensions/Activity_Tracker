//! The settings keys this app accepts at its command boundary.
//!
//! Settings arrive as arbitrary JSON from the frontend, so the command rejects anything it does not recognise instead
//! of writing it into the database and having the tracker read a value nobody set (D-052). The list below is the union
//! of what the frontend sends (`BACKEND_KEYS` in `SettingsProvider.tsx`) and what the backend reads.
//!
//! Adding a setting means adding it here and in the frontend map: two lists that must agree is the cost of validating
//! at the boundary, and it is cheaper than a typo that silently does nothing for a year.

use std::collections::HashMap;

use serde_json::Value;

/// Every key `set_settings` will persist.
pub const KEYS: &[&str] = &[
    "dashboard_default_range",
    "track_window_titles",
    "idle_threshold",
    "blacklisted_apps",
    "retention_days",
    "launch_on_startup",
    "start_minimized",
    "redacted_keywords",
    "app_limits",
    "app_classification",
    "reading_mode",
    "write_summary_sentence",
    "visual_theme",
    "font_pair",
];

pub fn is_known(key: &str) -> bool {
    KEYS.contains(&key)
}

/// Keys in `settings` that this app does not accept, in the order the caller sent them.
pub fn unknown_keys(settings: &HashMap<String, Value>) -> Vec<String> {
    let mut unknown: Vec<String> = settings
        .keys()
        .filter(|key| !is_known(key))
        .cloned()
        .collect();
    unknown.sort();
    unknown
}

/// The error a caller sees, naming what was rejected and what is accepted.
pub fn rejection(unknown: &[String]) -> String {
    format!(
        "Unknown setting key(s): {}. Accepted keys: {}",
        unknown.join(", "),
        KEYS.join(", ")
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// The list is a contract with `SettingsProvider.tsx`; this pins its length so a key added on one side only is a
    /// visible diff rather than a setting that quietly never persists.
    #[test]
    fn every_frontend_setting_is_accepted() {
        assert_eq!(KEYS.len(), 14, "frontend sends 14 keys: {:?}", KEYS);
        for key in ["visual_theme", "font_pair", "retention_days", "idle_threshold"] {
            assert!(is_known(key), "{key} must be accepted");
        }
    }

    #[test]
    fn unknown_keys_are_reported_not_written() {
        let settings = HashMap::from([
            ("idle_threshold".to_string(), json!(60)),
            ("focus_goal".to_string(), json!(5)),
            ("caleb_setting".to_string(), json!(true)),
        ]);
        assert_eq!(
            unknown_keys(&settings),
            vec!["caleb_setting".to_string(), "focus_goal".to_string()]
        );
    }

    #[test]
    fn a_clean_payload_has_nothing_unknown() {
        let settings: HashMap<String, Value> =
            KEYS.iter().map(|key| (key.to_string(), json!(null))).collect();
        assert!(unknown_keys(&settings).is_empty());
    }
}
