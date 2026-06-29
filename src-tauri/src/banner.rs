//! Transient on-screen banner shown when the default device changes. Like the
//! mute overlay it is topmost and click-through so it shows over fullscreen
//! apps, but it auto-hides after a short delay.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewWindow};

use crate::config;

pub const BANNER_LABEL: &str = "banner";

const WIDTH: f64 = 340.0;
const HEIGHT: f64 = 80.0;
const MARGIN: f64 = 24.0;
const SHOW_MS: u64 = 2600;

#[derive(Serialize, Clone)]
struct BannerPayload {
    name: String,
    direction: String,
}

/// Monotonic counter so only the latest banner's hide timer takes effect.
fn generation() -> &'static AtomicU64 {
    static G: OnceLock<AtomicU64> = OnceLock::new();
    G.get_or_init(|| AtomicU64::new(0))
}

/// One-time window configuration.
pub fn configure(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(BANNER_LABEL) {
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.set_always_on_top(true);
        #[cfg(windows)]
        apply_overlay_exstyle(&window);
    }
}

/// Shows the banner for `name`/`direction`, auto-hiding after a short delay.
pub fn show(app: &AppHandle, name: &str, direction: &str) {
    let Some(window) = app.get_webview_window(BANNER_LABEL) else {
        return;
    };
    let cfg = config::notifications(app);
    position(app, &window, &cfg.banner_position);
    let _ = window.set_size(LogicalSize::new(WIDTH, HEIGHT));

    let payload = BannerPayload {
        name: name.to_string(),
        direction: direction.to_string(),
    };

    // Show first so the suspended webview resumes, then push (and re-push) data.
    let _ = window.show();
    let _ = window.set_ignore_cursor_events(true);
    let _ = window.set_always_on_top(true);
    let _ = window.emit("banner-show", payload.clone());

    let retry = window.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(180));
        let _ = retry.emit("banner-show", payload);
    });

    let generation_id = generation().fetch_add(1, Ordering::SeqCst) + 1;
    let app_handle = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(SHOW_MS));
        if generation().load(Ordering::SeqCst) == generation_id {
            if let Some(window) = app_handle.get_webview_window(BANNER_LABEL) {
                let _ = window.hide();
            }
        }
    });
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
