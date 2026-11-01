//! Where an app's cached icon lives, and why the lookup tolerates file names the old naming produced.
//!
//! This is a pure path module on purpose: it is the part of icon handling that can be tested without a window, a
//! WebView2 runtime or a real icon — which is exactly why it moved here (D-057). Extracting a PNG from a binary stays in
//! the app crate where the Win32 handle lives.

use std::fs;
use std::path::{Path, PathBuf};

/// Cache file stem for a process name: the file stem, lowercased.
///
/// Process identity is case-insensitive at every lookup (D-021), so `EXCEL.EXE`, `excel.exe` and `Excel.Exe` are one
/// app and must land on one cache entry.
pub fn cache_stem(process_name: &str) -> String {
    Path::new(process_name)
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_lowercase())
        .unwrap_or_else(|| process_name.to_lowercase())
}

/// Cached PNG for a process, tolerating files written under the old mixed-case naming.
///
/// The store is lowercase since D-021, but the cache directory still holds files the previous naming produced
/// (`Hermes.png` for `Hermes.exe`). Without this lookup, an app that is not currently running would have to be
/// re-resolved every time it shows up in the Timeline.
pub fn cached_icon_path(cache_dir: &Path, clean_name: &str) -> Option<PathBuf> {
    let exact = cache_dir.join(format!("{}.png", clean_name));
    if exact.exists() {
        return Some(exact);
    }

    let wanted = format!("{}.png", clean_name.to_lowercase());
    fs::read_dir(cache_dir)
        .ok()?
        .flatten()
        .find(|entry| entry.file_name().to_string_lossy().to_lowercase() == wanted)
        .map(|entry| entry.path())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A scratch directory that does not collide with the real icon cache.
    fn temp_cache(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("at-icons-{}-{}", tag, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// The old naming left files like `Hermes.png` behind; an app that is not running has no other source, so the
    /// lookup must still find it.
    ///
    /// Note what this can and cannot prove on Windows: NTFS is case-insensitive, so `hermes.png`.exists() is already
    /// true when only `Hermes.png` is on disk and the exact-path shortcut answers first. The assertion is therefore the
    /// outcome — the file is found and reads back — not the spelling of the returned path. The directory scan below
    /// the shortcut is a guard for case-sensitive storage, which this machine cannot exercise.
    #[test]
    fn finds_the_cached_icon_for_an_app_that_is_not_running() {
        let dir = temp_cache("mixed");
        fs::write(dir.join("Hermes.png"), b"png").unwrap();

        let found = cached_icon_path(&dir, "hermes").expect("a cached icon must survive the old naming");

        assert_eq!(fs::read(&found).unwrap(), b"png");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn prefers_the_exact_lowercase_file_and_returns_none_when_absent() {
        let dir = temp_cache("exact");
        fs::write(dir.join("chrome.png"), b"png").unwrap();

        assert_eq!(cached_icon_path(&dir, "chrome"), Some(dir.join("chrome.png")));
        assert_eq!(cached_icon_path(&dir, "opera"), None, "a missing icon must not resolve to another app's file");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn strips_any_case_of_extension() {
        // "EXCEL.EXE" and "excel.exe" must land on the same cache entry.
        for name in ["EXCEL.EXE", "excel.exe", "Excel.Exe"] {
            assert_eq!(cache_stem(name), "excel");
        }
    }
}
