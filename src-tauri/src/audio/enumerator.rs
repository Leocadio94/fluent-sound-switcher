//! Enumerates audio endpoints and reports the current default device.
//!
//! Unplugged and disabled endpoints are listed too, not just active ones: a
//! headset that goes to sleep would otherwise vanish from the list and from the
//! cycle order, losing its place until it came back.

use std::ffi::c_void;

use serde::Serialize;
use windows::core::{PROPVARIANT, PWSTR};
use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use windows::Win32::Media::Audio::{
    eCapture, eConsole, eRender, EDataFlow, IMMDeviceEnumerator, MMDeviceEnumerator,
    DEVICE_STATE_ACTIVE, DEVICE_STATE_DISABLED, DEVICE_STATE_UNPLUGGED,
};
use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;
use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL, STGM_READ};

/// A playback or recording endpoint exposed to the frontend.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    /// Stable endpoint id (used as the key for switching).
    pub id: String,
    /// Human-friendly name, e.g. "Speakers (Realtek Audio)".
    pub name: String,
    /// `"output"` for render endpoints, `"input"` for capture endpoints.
    pub direction: &'static str,
    /// Whether this is the current default (console role) device.
    pub is_default: bool,
    /// `"active"`, `"unplugged"` or `"disabled"`. Only an active endpoint can
    /// be made the default or carry a volume level.
    pub state: &'static str,
}

impl AudioDevice {
    pub fn is_available(&self) -> bool {
        self.state == "active"
    }
}

/// Which endpoints to enumerate.
///
/// `NOTPRESENT` is deliberately left out — that means the driver is gone, so
/// the endpoint is not something the user can pick again by plugging anything
/// back in.
const LISTED_STATES: u32 =
    DEVICE_STATE_ACTIVE.0 | DEVICE_STATE_UNPLUGGED.0 | DEVICE_STATE_DISABLED.0;

/// Lists output and input endpoints — active, unplugged and disabled — marking
/// the current defaults.
pub fn list_devices() -> windows::core::Result<Vec<AudioDevice>> {
    super::ensure_com();
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let mut devices = Vec::new();
        collect(&enumerator, eRender, "output", &mut devices)?;
        collect(&enumerator, eCapture, "input", &mut devices)?;
        Ok(devices)
    }
}

/// The current default output (render) device, if any.
pub fn default_output() -> windows::core::Result<Option<AudioDevice>> {
    Ok(list_devices()?
        .into_iter()
        .find(|d| d.direction == "output" && d.is_default))
}

/// Maps a Windows endpoint state to the string the frontend uses.
fn state_name(state: windows::Win32::Media::Audio::DEVICE_STATE) -> &'static str {
    match state {
        DEVICE_STATE_UNPLUGGED => "unplugged",
        DEVICE_STATE_DISABLED => "disabled",
        _ => "active",
    }
}

unsafe fn collect(
    enumerator: &IMMDeviceEnumerator,
    flow: EDataFlow,
    direction: &'static str,
    out: &mut Vec<AudioDevice>,
) -> windows::core::Result<()> {
    // GetDefaultAudioEndpoint fails when there is no default for the flow
    // (e.g. no microphone). Treat that as "nothing is default".
    let default_id = enumerator
        .GetDefaultAudioEndpoint(flow, eConsole)
        .ok()
        .and_then(|device| device.GetId().ok())
        .and_then(|id| take_pwstr(id));

    let collection = enumerator.EnumAudioEndpoints(
        flow,
        windows::Win32::Media::Audio::DEVICE_STATE(LISTED_STATES),
    )?;
    let count = collection.GetCount()?;
    for i in 0..count {
        let device = collection.Item(i)?;
        let id = match device.GetId().ok().and_then(|p| take_pwstr(p)) {
            Some(id) => id,
            None => continue,
        };
        let name = device
            .OpenPropertyStore(STGM_READ)
            .ok()
            .and_then(|store| store.GetValue(&PKEY_Device_FriendlyName).ok())
            .and_then(|prop| propvariant_to_string(&prop))
            .unwrap_or_else(|| "Unknown device".to_string());

        // An endpoint that reports no state is treated as active: better to
        // offer it and have the switch fail than to hide a working device.
        let state = device.GetState().map(state_name).unwrap_or("active");

        out.push(AudioDevice {
            is_default: default_id.as_deref() == Some(id.as_str()),
            id,
            name,
            direction,
            state,
        });
    }
    Ok(())
}

/// Reads a COM-allocated wide string into an owned `String` and frees it.
unsafe fn take_pwstr(p: PWSTR) -> Option<String> {
    if p.is_null() {
        return None;
    }
    let s = p.to_string().ok();
    CoTaskMemFree(Some(p.0 as *const c_void));
    s
}

unsafe fn propvariant_to_string(prop: &PROPVARIANT) -> Option<String> {
    PropVariantToStringAlloc(prop)
        .ok()
        .and_then(|p| take_pwstr(p))
}

#[cfg(test)]
mod tests {
    use super::state_name;
    use windows::Win32::Media::Audio::{
        DEVICE_STATE, DEVICE_STATE_ACTIVE, DEVICE_STATE_DISABLED, DEVICE_STATE_NOTPRESENT,
        DEVICE_STATE_UNPLUGGED,
    };

    #[test]
    fn maps_the_states_the_ui_distinguishes() {
        assert_eq!(state_name(DEVICE_STATE_ACTIVE), "active");
        assert_eq!(state_name(DEVICE_STATE_UNPLUGGED), "unplugged");
        assert_eq!(state_name(DEVICE_STATE_DISABLED), "disabled");
    }

    #[test]
    fn treats_anything_unexpected_as_active() {
        // Better to offer a device and have the switch fail than to hide one
        // that works.
        assert_eq!(state_name(DEVICE_STATE_NOTPRESENT), "active");
        assert_eq!(state_name(DEVICE_STATE(0)), "active");
    }
}
