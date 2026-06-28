//! The on-screen mute overlay: a small, click-through, always-on-top window
//! that stays visible over fullscreen apps (fixing SoundSwitch's "behind the
//! taskbar" problem). Visibility follows the user's `muteIndicator` config.

use tauri::{AppHandle, Emitter, LogicalPosition, Manager, WebviewWindow};

use crate::config;

pub const OVERLAY_LABEL: &str = "overlay";

const WIDTH: f64 = 240.0;
const HEIGHT: f64 = 64.0;
const MARGIN: f64 = 24.0;

/// One-time window configuration: never steal focus, ignore the mouse, and sit
/// above everything including fullscreen windows.
pub fn configure(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.set_always_on_top(true);
        #[cfg(windows)]
        apply_overlay_exstyle(&window);
    }
}

/// Shows/hides and repositions the overlay based on the mute state and config,
/// and pushes the state to the overlay webview.
pub fn update(app: &AppHandle, muted: bool) {
    let Some(window) = app.get_webview_window(OVERLAY_LABEL) else {
        return;
    };
    let cfg = config::mute_indicator(app);
    let visible = match cfg.mode.as_str() {
        "always" => true,
        "mutedOnly" => muted,
        "unmutedOnly" => !muted,
        _ => false,
    };

    let _ = window.emit("overlay-state", muted);

    if visible {
        position(app, &window, &cfg.position);
        let _ = window.show();
        // Re-assert in case the OS reset it while the window was hidden.
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.set_always_on_top(true);
    } else {
        let _ = window.hide();
    }
}

fn position(app: &AppHandle, window: &WebviewWindow, pos: &str) {
    let (monitor_w, monitor_h) = match app.primary_monitor() {
        Ok(Some(monitor)) => {
            let size = monitor.size().to_logical::<f64>(monitor.scale_factor());
            (size.width, size.height)
        }
        _ => (1920.0, 1080.0),
    };

    let x = if pos.contains("Left") {
        MARGIN
    } else if pos.contains("Right") {
        monitor_w - WIDTH - MARGIN
    } else {
        (monitor_w - WIDTH) / 2.0
    };
    let y = if pos.starts_with("top") {
        MARGIN * 2.0
    } else {
        // Keep clear of the taskbar.
        monitor_h - HEIGHT - MARGIN * 3.0
    };

    let _ = window.set_position(LogicalPosition::new(x, y));
}

#[cfg(windows)]
fn apply_overlay_exstyle(window: &WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };
    // Tauri's `hwnd()` returns a HWND from a newer `windows` crate version, so
    // rebuild our (0.58) HWND from the raw pointer to keep the types consistent.
    let Ok(raw) = window.hwnd() else {
        return;
    };
    let hwnd = HWND(raw.0);
    unsafe {
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let ex = ex | (WS_EX_NOACTIVATE.0 as isize) | (WS_EX_TOOLWINDOW.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex);
    }
}
