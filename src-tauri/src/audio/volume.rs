//! Endpoint volume and mute via `IAudioEndpointVolume`.
//!
//! This used to resolve the default *capture* endpoint only and call nothing
//! but `GetMute`/`SetMute`, so the app could mute the microphone and do nothing
//! else with volume. Every operation now takes an optional device id and works
//! on either direction.

use super::AudioDevice;
use windows::core::HSTRING;
use windows::Win32::Foundation::BOOL;
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    eCapture, eConsole, eRender, EDataFlow, IMMDeviceEnumerator, MMDeviceEnumerator,
};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};

/// Resolves the endpoint volume interface for `device_id`, or for the default
/// endpoint of `flow` when no id is given.
pub(super) unsafe fn endpoint_volume(
    device_id: Option<&str>,
    flow: EDataFlow,
) -> windows::core::Result<IAudioEndpointVolume> {
    let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
    let device = match device_id {
        Some(id) => enumerator.GetDevice(&HSTRING::from(id))?,
        None => enumerator.GetDefaultAudioEndpoint(flow, eConsole)?,
    };
    device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
}

/// Maps the `"output"`/`"input"` strings used across the app to a data flow.
pub(super) fn flow_for(direction: &str) -> EDataFlow {
    if direction == "input" {
        eCapture
    } else {
        eRender
    }
}

// ------------------------------------------------------------------- mute

/// Toggles a device's mute, returning the new state. `None` targets the default
/// endpoint of `direction`.
pub fn toggle_mute(device_id: Option<&str>, direction: &str) -> windows::core::Result<bool> {
    super::ensure_com();
    unsafe {
        let volume = endpoint_volume(device_id, flow_for(direction))?;
        let muted = volume.GetMute()?.as_bool();
        volume.SetMute(BOOL::from(!muted), std::ptr::null())?;
        Ok(!muted)
    }
}

/// Reads a device's mute state.
pub fn is_muted(device_id: Option<&str>, direction: &str) -> windows::core::Result<bool> {
    super::ensure_com();
    unsafe {
        Ok(endpoint_volume(device_id, flow_for(direction))?
            .GetMute()?
            .as_bool())
    }
}

/// Sets a device's mute state explicitly.
pub fn set_mute(
    device_id: Option<&str>,
    direction: &str,
    muted: bool,
) -> windows::core::Result<()> {
    super::ensure_com();
    unsafe {
        endpoint_volume(device_id, flow_for(direction))?
            .SetMute(BOOL::from(muted), std::ptr::null())?;
        Ok(())
    }
}

// ----------------------------------------------------------------- volume

/// Master volume as a 0.0–1.0 scalar.
pub fn get_volume(device_id: Option<&str>, direction: &str) -> windows::core::Result<f32> {
    super::ensure_com();
    unsafe { endpoint_volume(device_id, flow_for(direction))?.GetMasterVolumeLevelScalar() }
}

/// Sets the master volume from a 0.0–1.0 scalar, clamped: the API rejects
/// anything outside that range and the value arrives from the UI.
pub fn set_volume(
    device_id: Option<&str>,
    direction: &str,
    level: f32,
) -> windows::core::Result<()> {
    super::ensure_com();
    let level = level.clamp(0.0, 1.0);
    unsafe {
        endpoint_volume(device_id, flow_for(direction))?
            .SetMasterVolumeLevelScalar(level, std::ptr::null())?;
        Ok(())
    }
}

/// Nudges the volume one step, returning the resulting level.
///
/// Uses `VolumeStepUp`/`VolumeStepDown` rather than adding a fixed amount, so
/// the increment matches the one Windows itself uses for this endpoint.
pub fn step_volume(
    device_id: Option<&str>,
    direction: &str,
    up: bool,
) -> windows::core::Result<f32> {
    super::ensure_com();
    unsafe {
        let volume = endpoint_volume(device_id, flow_for(direction))?;
        if up {
            volume.VolumeStepUp(std::ptr::null())?;
        } else {
            volume.VolumeStepDown(std::ptr::null())?;
        }
        volume.GetMasterVolumeLevelScalar()
    }
}

// -------------------------------------------------- microphone convenience
//
// Thin wrappers so `mute.rs`, the CLI and the existing commands do not have to
// spell out "the default capture endpoint" every time.

pub fn toggle_mic_mute() -> windows::core::Result<bool> {
    toggle_mute(None, "input")
}

pub fn is_mic_muted() -> windows::core::Result<bool> {
    is_muted(None, "input")
}

pub fn set_mic_mute(muted: bool) -> windows::core::Result<()> {
    set_mute(None, "input", muted)
}

/// Whether `device` is a capture endpoint a mute can be applied to.
fn is_live_capture(device: &AudioDevice) -> bool {
    device.direction == "input" && device.is_available()
}

/// Mutes or unmutes the default microphone and every other active capture
/// endpoint, so an app pinned to a non-default mic is silenced too.
///
/// The default goes first and its failure is the caller's: that is the state the
/// tray and overlay show. The others are best effort, since one stuck endpoint
/// should not leave the rest open.
pub fn set_all_mics_mute(muted: bool) -> windows::core::Result<()> {
    set_mic_mute(muted)?;
    for device in super::list_devices()?.iter().filter(|d| is_live_capture(d)) {
        if let Err(e) = set_mute(Some(&device.id), "input", muted) {
            log::warn!("could not set the mute of {}: {e}", device.name);
        }
    }
    Ok(())
}

/// Flips the default microphone's state and applies it to every active one.
pub fn toggle_all_mics_mute() -> windows::core::Result<bool> {
    let muted = !is_mic_muted()?;
    set_all_mics_mute(muted)?;
    Ok(muted)
}

/// Applies `muted` to `device_id` when it is an active capture endpoint, e.g. a
/// microphone that just arrived while the mute is on. Returns whether it applied.
///
/// The direction check is not optional: `set_mute` resolves by id and ignores
/// the flow, so an output id would mute the speakers.
pub fn set_capture_mute(device_id: &str, muted: bool) -> windows::core::Result<bool> {
    let is_target = super::list_devices()?
        .iter()
        .any(|d| d.id == device_id && is_live_capture(d));
    if is_target {
        set_mute(Some(device_id), "input", muted)?;
    }
    Ok(is_target)
}

#[cfg(test)]
mod tests {
    use super::{flow_for, is_live_capture};
    use crate::audio::AudioDevice;
    use windows::Win32::Media::Audio::{eCapture, eRender};

    fn device(direction: &'static str, state: &'static str) -> AudioDevice {
        AudioDevice {
            id: "id".into(),
            name: "name".into(),
            direction,
            is_default: false,
            state,
            is_bluetooth: false,
            bt_mac: None,
        }
    }

    #[test]
    fn only_active_capture_endpoints_take_the_mute() {
        assert!(is_live_capture(&device("input", "active")));
        // A speaker must never be muted by a microphone toggle.
        assert!(!is_live_capture(&device("output", "active")));
        assert!(!is_live_capture(&device("input", "unplugged")));
        assert!(!is_live_capture(&device("input", "disabled")));
    }

    #[test]
    fn input_maps_to_capture_and_everything_else_to_render() {
        assert_eq!(flow_for("input"), eCapture);
        assert_eq!(flow_for("output"), eRender);
        // The direction strings come from config and the IPC boundary, so an
        // unknown value must not silently target the microphone.
        assert_eq!(flow_for(""), eRender);
        assert_eq!(flow_for("speakers"), eRender);
    }
}
