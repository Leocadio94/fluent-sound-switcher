//! The on-screen overlay: a small, click-through, always-on-top window that
//! stays visible over fullscreen apps (fixing SoundSwitch's "behind the
//! taskbar" problem).
//!
//! It shows two things, one at a time:
//!  - the persistent mic-mute indicator, per the `muteIndicator` config;
//!  - a transient volume OSD, shown when a volume hotkey fires.
//!
//! Both share this one window on purpose: the app already keeps four WebView2
//! instances alive, and this one is already transparent, topmost and
//! click-through. When the volume OSD times out the window reverts to whatever
//! the mute indicator wants to be showing.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, LogicalSize, Manager};

use crate::auxwin;
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
const VOLUME_WIDTH: f64 = 260.0;
const HEIGHT: f64 = 72.0;
const MARGIN: f64 = 24.0;

/// How long the volume OSD stays up after the last change.
const VOLUME_SHOW_MS: u64 = 1500;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OverlayState {
    /// "mute" or "volume" — which face the overlay is currently showing.
    pub kind: &'static str,
    pub muted: bool,
    pub style: String,
    /// 0.0–1.0, only meaningful when `kind` is "volume".
    pub level: f32,
}

/// The state the overlay should be showing right now.
///
/// The overlay window is created hidden, so its WebView2 renderer is frozen and
/// can drop the `overlay-state` events pushed at it. When every one was missed
/// the React side kept its initial guess — full style — and rendered the text
/// label inside a window sized for the icon-only style, clipping it. Letting it
/// *ask* on mount removes the dependency on that timing entirely.
pub fn current_state(app: &AppHandle) -> OverlayState {
    OverlayState {
        kind: "mute",
        muted: crate::mute::current(app),
        style: config::mute_indicator(app).style,
        level: 0.0,
    }
}

/// Monotonic counter identifying the newest state pushed at the overlay.
///
/// Two things depend on it. A burst of volume-up presses must not have the
/// first one's timer hide the overlay while the last is still on screen; and
/// the re-emit retries below must not keep republishing a payload that has
/// since been superseded — cycling devices quickly used to make the overlay
/// flicker between old and new states until the last retry drained.
fn generation() -> &'static AtomicU64 {
    static G: OnceLock<AtomicU64> = OnceLock::new();
    G.get_or_init(|| AtomicU64::new(0))
}

/// One-time window configuration: never steal focus, ignore the mouse, and sit
/// above everything including fullscreen windows.
pub fn configure(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.set_always_on_top(true);
        auxwin::apply_overlay_exstyle(&window);
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
        kind: "mute",
        muted,
        style: cfg.style.clone(),
        level: 0.0,
    };

    if visible {
        let width = if cfg.style == "icon" {
            ICON_WIDTH
        } else {
            FULL_WIDTH
        };
        let _ = window.set_size(LogicalSize::new(width, HEIGHT));
        auxwin::anchor(app, &window, &cfg.position, width, HEIGHT, MARGIN);
        // Show first so the frozen webview starts resuming, then push the state
        // (and re-push it) so the resumed renderer paints the correct pill.
        let _ = window.show();
        // Re-assert in case the OS reset it while the window was hidden.
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.set_always_on_top(true);
        emit_state(app, payload);
    } else {
        let _ = window.hide();
        // Supersede anything still retrying, then push the state so the
        // (hidden) webview stays in sync for the next time it is shown. No
        // retries needed while hidden.
        generation().fetch_add(1, Ordering::SeqCst);
        let _ = app.emit("overlay-state", payload);
    }
}

/// Flashes the volume OSD at `level` (0.0–1.0), then restores the mute
/// indicator. Does nothing when the user turned the OSD off.
pub fn show_volume(app: &AppHandle, level: f32) {
    let cfg = config::volume_osd(app);
    if !cfg.enabled {
        return;
    }
    let Some(window) = app.get_webview_window(OVERLAY_LABEL) else {
        return;
    };

    let payload = OverlayState {
        kind: "volume",
        muted: crate::mute::current_output(app),
        style: "full".to_string(),
        level: level.clamp(0.0, 1.0),
    };

    let _ = window.set_size(LogicalSize::new(VOLUME_WIDTH, HEIGHT));
    auxwin::anchor(app, &window, &cfg.position, VOLUME_WIDTH, HEIGHT, MARGIN);
    let _ = window.show();
    let _ = window.set_ignore_cursor_events(true);
    let _ = window.set_always_on_top(true);
    let generation_id = emit_state(app, payload);

    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(VOLUME_SHOW_MS));
        // Only the newest OSD restores the mute indicator.
        if generation().load(Ordering::SeqCst) == generation_id {
            update(&app, crate::mute::current(&app));
        }
    });
}

/// Emits the overlay state immediately and re-emits it a few times, covering a
/// just-shown webview whose renderer is still resuming (see `EMIT_RETRIES_MS`).
///
/// Returns the generation this emission belongs to. The retries stop as soon as
/// a newer state supersedes it, so a quick burst of changes settles on the last
/// one instead of flickering through the backlog of every earlier payload.
fn emit_state(app: &AppHandle, payload: OverlayState) -> u64 {
    let generation_id = generation().fetch_add(1, Ordering::SeqCst) + 1;
    let _ = app.emit("overlay-state", payload.clone());

    let app = app.clone();
    thread::spawn(move || {
        for delay in EMIT_RETRIES_MS {
            thread::sleep(Duration::from_millis(delay));
            if generation().load(Ordering::SeqCst) != generation_id {
                return;
            }
            let _ = app.emit("overlay-state", payload.clone());
        }
    });

    generation_id
}
