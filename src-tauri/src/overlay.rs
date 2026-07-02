//! The on-screen mute overlay: a small, click-through, always-on-top window
//! that stays visible over fullscreen apps (fixing SoundSwitch's "behind the
//! taskbar" problem). Visibility/style follow the user's `muteIndicator` config.

use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewWindow};

use crate::config::{self, MuteIndicator};

pub const OVERLAY_LABEL: &str = "overlay";

/// A freshly-shown aux window's WebView2 renderer resumes from a frozen state
/// asynchronously, and Tauri events fired at a frozen renderer can be dropped.
/// Re-emit the payload a few times (inter-emit gaps, ~0.7s total) so the
/// resuming webview reliably receives it. Emitting is idempotent (it only
/// drives React state), so extra deliveries are harmless.
const EMIT_RETRIES_MS: [u64; 3] = [80, 200, 400];

const FULL_WIDTH: f64 = 240.0;
const ICON_WIDTH: f64 = 78.0;
const HEIGHT: f64 = 72.0;
const MARGIN: f64 = 24.0;

#[derive(Serialize, Clone)]
struct OverlayState {
    muted: bool,
    style: String,
}

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

/// Shows/hides the overlay using the stored config (mute toggles, startup).
pub fn update(app: &AppHandle, muted: bool) {
    update_with(app, muted, &config::mute_indicator(app));
}

/// Shows/hides and styles the overlay using an explicit config. Used right
/// after a settings change so we don't race the store's async file write.
pub fn update_with(app: &AppHandle, muted: bool, cfg: &MuteIndicator) {
    let Some(window) = app.get_webview_window(OVERLAY_LABEL) else {
        return;
    };
    let visible = match cfg.mode.as_str() {
        "always" => true,
        "mutedOnly" => muted,
        "unmutedOnly" => !muted,
        _ => false,
    };

    let payload = OverlayState {
        muted,
        style: cfg.style.clone(),
    };

    if visible {
        let width = if cfg.style == "icon" {
            ICON_WIDTH
        } else {
            FULL_WIDTH
        };
        let _ = window.set_size(LogicalSize::new(width, HEIGHT));
        position(app, &window, &cfg.position, width);
        // Show first so the frozen webview starts resuming, then push the state
        // (and re-push it) so the resumed renderer paints the correct pill.
        let _ = window.show();
        // Re-assert in case the OS reset it while the window was hidden.
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.set_always_on_top(true);
        emit_state(app, payload);
    } else {
        let _ = window.hide();
        // Still push the state so the (hidden) webview stays in sync for the
        // next time it is shown; no retries needed while hidden.
        let _ = app.emit("overlay-state", payload);
    }
}

/// Emits the overlay state immediately and re-emits it a few times, covering a
/// just-shown webview whose renderer is still resuming (see `EMIT_RETRIES_MS`).
fn emit_state(app: &AppHandle, payload: OverlayState) {
    let _ = app.emit("overlay-state", payload.clone());
    let app = app.clone();
    thread::spawn(move || {
        for delay in EMIT_RETRIES_MS {
            thread::sleep(Duration::from_millis(delay));
            let _ = app.emit("overlay-state", payload.clone());
        }
    });
}

fn position(app: &AppHandle, window: &WebviewWindow, pos: &str, width: f64) {
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
        monitor_w - width - MARGIN
    } else {
        (monitor_w - width) / 2.0
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
