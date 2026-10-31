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

/// Flips the microphone mute, covering every active capture endpoint when the
/// `micMuteAllDevices` setting is on, and propagates the result.
///
/// The one entry point for the hotkey, the tray, the gamepad and the UI, so
/// they cannot disagree about the scope.
pub fn toggle_mic(app: &AppHandle) -> windows::core::Result<bool> {
    let muted = if crate::config::mic_mute_all(app) {
        crate::audio::toggle_all_mics_mute()?
    } else {
        crate::audio::toggle_mic_mute()?
    };
    apply(app, muted);
    crate::callmute::trigger(app);
    Ok(muted)
}

/// Toggles the microphone mute, logging a failure instead of returning it.
pub fn toggle(app: &AppHandle) {
    // Leaving the tray/overlay showing the previous state is confusing on its
    // own; at least leave a trace of why.
    if let Err(e) = toggle_mic(app) {
        log::error!("could not toggle the mic mute: {e}");
    }
}

/// Brings a microphone that just arrived in line with the current mute state.
///
/// Windows keeps the flag per endpoint, and an unplugged one is skipped by the
/// toggle, so it comes back with whatever it had. Syncing both ways covers a
/// mute that was turned on *and* one that was lifted while it was away.
pub fn sync_arrived_mic(app: &AppHandle, device_id: &str) {
    if !crate::config::mic_mute_all(app) {
        return;
    }
    let muted = current(app);
    match crate::audio::set_capture_mute(device_id, muted) {
        Ok(true) => {
            log::info!("set the microphone that just arrived to muted={muted} ({device_id})")
        }
        Ok(false) => {}
        Err(e) => log::warn!("could not sync the arrived microphone {device_id}: {e}"),
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
