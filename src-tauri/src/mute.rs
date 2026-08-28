//! Central mic-mute state. Any mute change funnels through here so the tray
//! icon, the on-screen overlay and the frontend all stay in sync.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter, Manager};

/// Managed state holding the last known mic mute status.
#[derive(Default)]
pub struct MuteState(AtomicBool);

/// The last applied mute state.
pub fn current(app: &AppHandle) -> bool {
    app.state::<MuteState>().0.load(Ordering::Relaxed)
}

/// Propagates a mute state to the tray, overlay and frontend.
pub fn apply(app: &AppHandle, muted: bool) {
    app.state::<MuteState>().0.store(muted, Ordering::Relaxed);
    crate::tray::set_mute_icon(app, muted);
    crate::overlay::update(app, muted);
    if let Err(e) = app.emit("mic-mute-changed", muted) {
        log::warn!("could not emit mic-mute-changed: {e}");
    }
}

/// Toggles the hardware mute, then propagates the result.
pub fn toggle(app: &AppHandle) {
    match crate::audio::toggle_mic_mute() {
        Ok(muted) => apply(app, muted),
        // Leaving the tray/overlay showing the previous state is confusing on
        // its own; at least leave a trace of why.
        Err(e) => log::error!("could not toggle the mic mute: {e}"),
    }
}

/// Reads the real hardware mute state and propagates it (startup / refresh).
pub fn refresh(app: &AppHandle) {
    match crate::audio::is_mic_muted() {
        Ok(muted) => apply(app, muted),
        Err(e) => log::error!("could not read the mic mute state: {e}"),
    }
}
