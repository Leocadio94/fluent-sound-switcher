//! The tray quick-switch flyout: a small, focusable, always-on-top window that
//! opens on a left-click of the tray icon, anchored above the taskbar so it
//! stays usable in fullscreen apps. It lists the favorite devices for fast
//! switching and dismisses on blur.

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

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
        #[cfg(windows)]
        apply_toolwindow(&window);

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
        reposition(&window, height);
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
    reposition(&window, height);
}

fn current_height(window: &WebviewWindow) -> f64 {
    let scale = window.scale_factor().unwrap_or(1.0);
    window
        .inner_size()
        .map(|s| s.height as f64 / scale)
        .unwrap_or(DEFAULT_HEIGHT)
}

fn reposition(window: &WebviewWindow, height_logical: f64) {
    let scale = window.scale_factor().unwrap_or(1.0);
    let (left, top, right, bottom) = work_area();
    let width_p = WIDTH * scale;
    let height_p = height_logical * scale;
    let margin_p = MARGIN * scale;
    let x = (right - width_p - margin_p).max(left);
    let y = (bottom - height_p - margin_p).max(top);
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

/// Returns the primary monitor work area (physical px), i.e. excluding the
/// taskbar, so the flyout sits just above it.
#[cfg(windows)]
fn work_area() -> (f64, f64, f64, f64) {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{
        SystemParametersInfoW, SPI_GETWORKAREA, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS,
    };
    let mut rect = RECT::default();
    unsafe {
        if let Err(e) = SystemParametersInfoW(
            SPI_GETWORKAREA,
            0,
            Some(&mut rect as *mut _ as *mut core::ffi::c_void),
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        ) {
            // `rect` stays zeroed, which parks the flyout in the top-left
            // corner — a symptom that is otherwise impossible to explain.
            log::error!("SPI_GETWORKAREA failed ({e}); flyout position will be wrong");
        }
    }
    (
        rect.left as f64,
        rect.top as f64,
        rect.right as f64,
        rect.bottom as f64,
    )
}

#[cfg(not(windows))]
fn work_area() -> (f64, f64, f64, f64) {
    (0.0, 0.0, 1920.0, 1040.0)
}

#[cfg(windows)]
fn apply_toolwindow(window: &WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_TOOLWINDOW,
    };
    let Ok(raw) = window.hwnd() else {
        return;
    };
    let hwnd = HWND(raw.0);
    unsafe {
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex | (WS_EX_TOOLWINDOW.0 as isize));
    }
}
