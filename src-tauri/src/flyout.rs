//! The tray quick-switch flyout: a small, focusable, always-on-top window that
//! opens on a left-click of the tray icon, anchored above the taskbar so it
//! stays usable in fullscreen apps. It lists the favorite devices for fast
//! switching and dismisses on blur.

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::auxwin;

pub const FLYOUT_LABEL: &str = "flyout";

const WIDTH: f64 = 300.0;
const MARGIN: f64 = 12.0;
const DEFAULT_HEIGHT: f64 = 220.0;

/// One-time setup: keep it above everything, out of the taskbar/alt-tab, and
/// dismiss it when it loses focus.
pub fn configure(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(FLYOUT_LABEL) {
        let _ = window.set_always_on_top(true);
        let _ = window.set_skip_taskbar(true);
        auxwin::apply_overlay_exstyle(&window);

        let dismiss = window.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::Focused(false) = event {
                let _ = dismiss.hide();
            }
        });
    }
}

/// Toggles the flyout. When shown it is repositioned above the taskbar and
/// given focus so the blur handler can later dismiss it.
pub fn toggle(app: &AppHandle) {
    let Some(window) = app.get_webview_window(FLYOUT_LABEL) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let height = current_height(&window);
        reposition(app, &window, height);
        let _ = window.show();
        let _ = window.set_focus();
        // The webview is suspended while hidden and may have missed live
        // events, so re-push the current device + mute state on open.
        let _ = window.emit("device-changed", ());
        let _ = window.emit("mic-mute-changed", crate::mute::current(app));
    }
}

/// Hides the flyout (used after a device is picked).
pub fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(FLYOUT_LABEL) {
        let _ = window.hide();
    }
}

/// Resizes the flyout to its content height (logical px) and repositions it.
pub fn set_size(app: &AppHandle, height: f64) {
    let Some(window) = app.get_webview_window(FLYOUT_LABEL) else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let _ = window.set_size(PhysicalSize::new(
        (WIDTH * scale) as u32,
        (height.max(64.0) * scale) as u32,
    ));
    reposition(app, &window, height);
}

fn current_height(window: &WebviewWindow) -> f64 {
    let scale = window.scale_factor().unwrap_or(1.0);
    window
        .inner_size()
        .map(|s| s.height as f64 / scale)
        .unwrap_or(DEFAULT_HEIGHT)
}

fn reposition(app: &AppHandle, window: &WebviewWindow, height_logical: f64) {
    let preference = crate::config::overlay_monitor(app);
    let Some(area) = auxwin::work_area(app, &preference) else {
        log::warn!("no monitor resolved; leaving the flyout where it is");
        return;
    };
    // Match the monitor the flyout lands on, not the window's stale DPI.
    let scale = area.scale;
    let (left, top, right, bottom) = (area.left, area.top, area.right, area.bottom);
    let width_p = WIDTH * scale;
    let height_p = height_logical * scale;
    let margin_p = MARGIN * scale;
    let x = (right - width_p - margin_p).max(left);
    let y = (bottom - height_p - margin_p).max(top);
    let _ = window.set_position(PhysicalPosition::new(x, y));
}
