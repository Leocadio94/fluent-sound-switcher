//! Mirrors *external* volume/mute changes on the default output into the app,
//! via `IAudioEndpointVolumeCallback`.
//!
//! Without this the slider and the OSD only knew about changes we made
//! ourselves: turning the volume wheel on a keyboard, or moving the Windows
//! mixer, left our UI showing a stale level.
//!
//! Like `IMMNotificationClient`, these callbacks arrive on a Windows audio
//! thread, so the handler does nothing but forward a value.

use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use windows::core::{implement, Result};
use windows::Win32::Media::Audio::eRender;
use windows::Win32::Media::Audio::Endpoints::{
    IAudioEndpointVolume, IAudioEndpointVolumeCallback, IAudioEndpointVolumeCallback_Impl,
};
use windows::Win32::Media::Audio::AUDIO_VOLUME_NOTIFICATION_DATA;

/// Payload of the `volume-changed` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeChanged {
    /// 0.0–1.0 master level.
    pub level: f32,
    pub muted: bool,
    /// Always "output" for now: only the default render endpoint is watched.
    pub direction: &'static str,
}

#[implement(IAudioEndpointVolumeCallback)]
struct VolumeNotifier {
    app: AppHandle,
}

impl IAudioEndpointVolumeCallback_Impl for VolumeNotifier_Impl {
    fn OnNotify(&self, data: *mut AUDIO_VOLUME_NOTIFICATION_DATA) -> Result<()> {
        // The pointer is only valid for the duration of the call, so read what
        // we need and hand off a plain value.
        let Some(data) = (unsafe { data.as_ref() }) else {
            return Ok(());
        };
        let payload = VolumeChanged {
            level: data.fMasterVolume,
            muted: data.bMuted.as_bool(),
            direction: "output",
        };

        let app = self.app.clone();
        tauri::async_runtime::spawn_blocking(move || {
            log::debug!(
                "endpoint volume changed: level={:.2} muted={}",
                payload.level,
                payload.muted
            );
            if let Err(e) = app.emit("volume-changed", payload.clone()) {
                log::warn!("could not emit volume-changed: {e}");
            }
            crate::mute::apply_output(&app, payload.muted);
        });
        Ok(())
    }
}

/// The registration currently in place, kept so it can be undone when the
/// default output changes.
struct Registration {
    volume: IAudioEndpointVolume,
    callback: IAudioEndpointVolumeCallback,
}

// SAFETY: `ensure_com` initializes COM as `COINIT_MULTITHREADED`, so these
// interfaces live in the MTA and carry no thread affinity; and the pair is only
// ever reached through the mutex below, which serializes every access.
unsafe impl Send for Registration {}

fn current() -> &'static Mutex<Option<Registration>> {
    static CURRENT: OnceLock<Mutex<Option<Registration>>> = OnceLock::new();
    CURRENT.get_or_init(|| Mutex::new(None))
}

/// (Re-)registers the volume callback on the current default output endpoint.
///
/// Called at startup and whenever the default output changes — the callback is
/// bound to one endpoint, so a switch would otherwise leave us listening to the
/// device the user just moved away from.
pub fn rearm(app: &AppHandle) {
    crate::audio::ensure_com();

    let Ok(mut slot) = current().lock() else {
        log::error!("volume-callback registration mutex poisoned");
        return;
    };

    // Drop the previous registration first, so we do not accumulate callbacks
    // across switches.
    if let Some(previous) = slot.take() {
        unsafe {
            if let Err(e) = previous
                .volume
                .UnregisterControlChangeNotify(&previous.callback)
            {
                log::warn!("could not unregister the previous volume callback: {e}");
            }
        }
    }

    unsafe {
        let volume = match super::volume::endpoint_volume(None, eRender) {
            Ok(volume) => volume,
            Err(e) => {
                log::warn!("no default output to watch for volume changes: {e}");
                return;
            }
        };
        let callback: IAudioEndpointVolumeCallback = VolumeNotifier { app: app.clone() }.into();
        if let Err(e) = volume.RegisterControlChangeNotify(&callback) {
            log::error!("volume callback registration failed: {e}");
            return;
        }
        *slot = Some(Registration { volume, callback });
    }
}
