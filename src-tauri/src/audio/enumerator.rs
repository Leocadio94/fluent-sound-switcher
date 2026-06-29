//! Enumerates active audio endpoints and reports the current default device.

use std::ffi::c_void;

use serde::Serialize;
use windows::core::{PROPVARIANT, PWSTR};
use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use windows::Win32::Media::Audio::{
    eCapture, eConsole, eRender, EDataFlow, IMMDeviceEnumerator, MMDeviceEnumerator,
    DEVICE_STATE_ACTIVE,
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
}

/// Lists all active output and input endpoints, marking the current defaults.
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

    let collection = enumerator.EnumAudioEndpoints(flow, DEVICE_STATE_ACTIVE)?;
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

        out.push(AudioDevice {
            is_default: default_id.as_deref() == Some(id.as_str()),
            id,
            name,
            direction,
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
