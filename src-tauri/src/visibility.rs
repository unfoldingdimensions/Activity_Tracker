//! Showing and hiding a window together with the webview inside it.
//!
//! `WebviewWindow::hide()` hides only the window (`webview_window.rs:1933` calls `self.window.hide()`), so
//! WebView2's controller keeps `IsVisible = true`. Chromium therefore never marks the page hidden and keeps
//! animating and compositing at display rate — measured on the installed app with the window invisible:
//! **240 rAF/s, GPU 34 % + renderer 20 % of one core** (D-042). Hiding the webview is what switches that off.
//!
//! Every caller goes through here, so the window and its webview cannot disagree about being visible: one of
//! them visible and the other not means either a page rendering for nobody, or a blank window.

/// Hide the webview, then the window.
pub fn hide(window: &tauri::WebviewWindow) {
    let webview: &tauri::Webview = window.as_ref();
    if let Err(err) = webview.hide() {
        log::warn!("Could not hide the webview inside the window: {err}");
    }
    if let Err(err) = window.hide() {
        log::warn!("Could not hide the window: {err}");
    }
}

/// Show the webview only, for callers that show the window themselves (the Win32 restore path).
pub fn show_webview(window: &tauri::WebviewWindow) {
    let webview: &tauri::Webview = window.as_ref();
    if let Err(err) = webview.show() {
        log::warn!("Could not show the webview inside the window: {err}");
    }
}

/// Show the webview, then the window — the reverse order from [`hide`].
///
/// The webview is made visible while the window is still hidden, so the first frame the user sees is already
/// rendered rather than a blank rectangle.
pub fn show(window: &tauri::WebviewWindow) {
    show_webview(window);
    if let Err(err) = window.show() {
        log::warn!("Could not show the window: {err}");
    }
}
