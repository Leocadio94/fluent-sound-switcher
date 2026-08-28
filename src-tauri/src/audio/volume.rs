//! Endpoint volume and mute via `IAudioEndpointVolume`.
//!
//! This used to resolve the default *capture* endpoint only and call nothing
//! but `GetMute`/`SetMute`, so the app could mute the microphone and do nothing
//! else with volume. Every operation now takes an optional device id and works
//! on either direction.

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

#[cfg(test)]
mod tests {
    use super::flow_for;
    use windows::Win32::Media::Audio::{eCapture, eRender};

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
