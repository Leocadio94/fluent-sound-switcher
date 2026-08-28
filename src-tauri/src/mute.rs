//! Central mute state. Any mute change funnels through here so the tray icon,
//! the on-screen overlay and the frontend all stay in sync.
//!
//! There are two independent states: the microphone (what the tray icon and the
//! mute overlay have always shown) and the default output. This used to hold a
//! single flag, which left output mute nowhere to live.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter, Manager};

/// Last known mute status of the default capture and render endpoints.
#[derive(Default)]
pub struct MuteState {
    mic: AtomicBool,
    output: AtomicBool,
}

/// The last applied microphone mute state.
pub fn current(app: &AppHandle) -> bool {
    app.state::<MuteState>().mic.load(Ordering::Relaxed)
}

/// The last applied output mute state.
pub fn current_output(app: &AppHandle) -> bool {
    app.state::<MuteState>().output.load(Ordering::Relaxed)
}

/// Propagates a microphone mute state to the tray, overlay and frontend.
pub fn apply(app: &AppHandle, muted: bool) {
    app.state::<MuteState>().mic.store(muted, Ordering::Relaxed);
    crate::tray::set_mute_icon(app, muted);
    crate::overlay::update(app, muted);
    if let Err(e) = app.emit("mic-mute-changed", muted) {
        log::warn!("could not emit mic-mute-changed: {e}");
    }
}

/// Propagates an output mute state to the frontend.
///
/// Called both by our own toggle and by the endpoint-volume callback, so a mute
/// applied from the Windows mixer shows up here too. The swap keeps it quiet
/// when nothing actually changed: that callback fires for every change,
/// including the ones we caused.
pub fn apply_output(app: &AppHandle, muted: bool) {
    let previous = app
        .state::<MuteState>()
        .output
        .swap(muted, Ordering::Relaxed);
    if previous == muted {
        return;
    }
    if let Err(e) = app.emit("output-mute-changed", muted) {
        log::warn!("could not emit output-mute-changed: {e}");
    }
}

/// Toggles the hardware microphone mute, then propagates the result.
pub fn toggle(app: &AppHandle) {
    match crate::audio::toggle_mic_mute() {
        Ok(muted) => apply(app, muted),
        // Leaving the tray/overlay showing the previous state is confusing on
        // its own; at least leave a trace of why.
        Err(e) => log::error!("could not toggle the mic mute: {e}"),
    }
}

/// Toggles the default output's mute, then propagates the result.
pub fn toggle_output(app: &AppHandle) {
    match crate::audio::toggle_mute(None, "output") {
        Ok(muted) => apply_output(app, muted),
        Err(e) => log::error!("could not toggle the output mute: {e}"),
    }
}

/// Reads the real hardware mute states and propagates them (startup / refresh).
pub fn refresh(app: &AppHandle) {
    match crate::audio::is_mic_muted() {
        Ok(muted) => apply(app, muted),
        Err(e) => log::error!("could not read the mic mute state: {e}"),
    }
    refresh_output(app);
}

/// Re-reads the default output's mute state. Called when the default output
/// changes, so the stored state never describes a device we no longer use.
pub fn refresh_output(app: &AppHandle) {
    match crate::audio::is_muted(None, "output") {
        Ok(muted) => {
            // Emit unconditionally here, unlike `apply_output`: a window that
            // just opened needs the current state even if it has not changed.
            app.state::<MuteState>()
                .output
                .store(muted, Ordering::Relaxed);
            if let Err(e) = app.emit("output-mute-changed", muted) {
                log::warn!("could not emit output-mute-changed: {e}");
            }
        }
        Err(e) => log::warn!("could not read the output mute state: {e}"),
    }
}
