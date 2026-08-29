//! Transient on-screen banner shown when the default device changes. Like the
//! mute overlay it is topmost and click-through so it shows over fullscreen
//! apps, but it auto-hides after a short delay.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, LogicalSize, Manager};

use crate::auxwin;
use crate::config;

pub const BANNER_LABEL: &str = "banner";

const WIDTH: f64 = 340.0;
const HEIGHT: f64 = 80.0;
const MARGIN: f64 = 24.0;
const SHOW_MS: u64 = 2600;

/// A just-shown aux window's WebView2 renderer resumes asynchronously and can
/// drop events fired while frozen; re-push the payload a few times (inter-emit
/// gaps) so the resuming renderer reliably paints the banner.
const EMIT_RETRIES_MS: [u64; 3] = [80, 200, 400];

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
        auxwin::apply_overlay_exstyle(&window);
    }
}

/// Shows the banner for `name`/`direction`, auto-hiding after a short delay.
pub fn show(app: &AppHandle, name: &str, direction: &str) {
    let Some(window) = app.get_webview_window(BANNER_LABEL) else {
        return;
    };
    let cfg = config::notifications(app);
    auxwin::anchor(app, &window, &cfg.banner_position, WIDTH, HEIGHT, MARGIN);
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

    // One generation per banner, driving both the retries and the auto-hide.
    let generation_id = generation().fetch_add(1, Ordering::SeqCst) + 1;

    let retry = window.clone();
    thread::spawn(move || {
        for delay in EMIT_RETRIES_MS {
            thread::sleep(Duration::from_millis(delay));
            // Switching devices in quick succession used to have an earlier
            // banner's retries redraw it over the newer one.
            if generation().load(Ordering::SeqCst) != generation_id {
                return;
            }
            let _ = retry.emit("banner-show", payload.clone());
        }
    });

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
