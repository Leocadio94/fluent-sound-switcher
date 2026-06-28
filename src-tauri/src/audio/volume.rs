//! Microphone mute control via `IAudioEndpointVolume` on the default capture
//! endpoint.

use windows::Win32::Foundation::BOOL;
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    eCapture, eConsole, IMMDeviceEnumerator, MMDeviceEnumerator,
};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};

/// Returns the endpoint volume interface for the default capture device.
unsafe fn default_mic_volume() -> windows::core::Result<IAudioEndpointVolume> {
    let enumerator: IMMDeviceEnumerator =
        CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
    let device = enumerator.GetDefaultAudioEndpoint(eCapture, eConsole)?;
    device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
}

/// Toggles the default microphone's mute state, returning the new state.
pub fn toggle_mic_mute() -> windows::core::Result<bool> {
    super::ensure_com();
    unsafe {
        let volume = default_mic_volume()?;
        let muted = volume.GetMute()?.as_bool();
        volume.SetMute(BOOL::from(!muted), std::ptr::null())?;
        Ok(!muted)
    }
}

/// Reads the default microphone's current mute state.
pub fn is_mic_muted() -> windows::core::Result<bool> {
    super::ensure_com();
    unsafe { Ok(default_mic_volume()?.GetMute()?.as_bool()) }
}

/// Sets the default microphone mute state explicitly.
#[allow(dead_code)] // used by the settings UI / CLI in later phases
pub fn set_mic_mute(muted: bool) -> windows::core::Result<()> {
    super::ensure_com();
    unsafe {
        default_mic_volume()?.SetMute(BOOL::from(muted), std::ptr::null())?;
        Ok(())
    }
}