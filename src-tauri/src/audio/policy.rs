//! Switches the default audio endpoint via the undocumented `IPolicyConfig`
//! COM interface (the same mechanism the Windows sound control panel uses).
//!
//! There is no public API for this. `IPolicyConfig` is exposed by the
//! `CPolicyConfigClient` COM object; its vtable layout is well documented by
//! reverse-engineering and is stable across Windows 10/11. We declare it here
//! and only call `SetDefaultEndpoint`.

use std::ffi::c_void;

use windows::core::{interface, IUnknown, IUnknown_Vtbl, GUID, HRESULT, HSTRING, PCWSTR};
use windows::Win32::Media::Audio::{eCommunications, eConsole, eMultimedia, ERole};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};

/// CLSID of `CPolicyConfigClient`.
const CLSID_POLICY_CONFIG: GUID = GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);

/// `IPolicyConfig` — only `SetDefaultEndpoint` is exercised; the other slots
/// exist purely to keep the vtable layout correct.
#[interface("f8679f50-850a-41cf-9c72-430f290290c8")]
unsafe trait IPolicyConfig: IUnknown {
    unsafe fn get_mix_format(&self, _id: PCWSTR, _fmt: *mut *mut c_void) -> HRESULT;
    unsafe fn get_device_format(
        &self,
        _id: PCWSTR,
        _default: i32,
        _fmt: *mut *mut c_void,
    ) -> HRESULT;
    unsafe fn reset_device_format(&self, _id: PCWSTR) -> HRESULT;
    unsafe fn set_device_format(
        &self,
        _id: PCWSTR,
        _endpoint_fmt: *mut c_void,
        _mix_fmt: *mut c_void,
    ) -> HRESULT;
    unsafe fn get_processing_period(
        &self,
        _id: PCWSTR,
        _default: i32,
        _default_period: *mut i64,
        _min_period: *mut i64,
    ) -> HRESULT;
    unsafe fn set_processing_period(&self, _id: PCWSTR, _period: *mut i64) -> HRESULT;
    unsafe fn get_share_mode(&self, _id: PCWSTR, _mode: *mut c_void) -> HRESULT;
    unsafe fn set_share_mode(&self, _id: PCWSTR, _mode: *mut c_void) -> HRESULT;
    unsafe fn get_property_value(
        &self,
        _id: PCWSTR,
        _key: *const c_void,
        _value: *mut c_void,
    ) -> HRESULT;
    unsafe fn set_property_value(
        &self,
        _id: PCWSTR,
        _key: *const c_void,
        _value: *mut c_void,
    ) -> HRESULT;
    /// Sets the device as the default endpoint for the given role.
    unsafe fn set_default_endpoint(&self, device_id: PCWSTR, role: ERole) -> HRESULT;
    unsafe fn set_endpoint_visibility(&self, _id: PCWSTR, _visible: i32) -> HRESULT;
}

/// Makes `device_id` the default endpoint for all three roles (console,
/// multimedia and communications), matching what SoundSwitch and the Windows
/// UI do so apps that pin to a specific role all follow the switch.
pub fn set_default_device(device_id: &str) -> windows::core::Result<()> {
    super::ensure_com();
    unsafe {
        let config: IPolicyConfig = CoCreateInstance(&CLSID_POLICY_CONFIG, None, CLSCTX_ALL)?;
        let id = HSTRING::from(device_id);
        for role in [eConsole, eMultimedia, eCommunications] {
            config
                .set_default_endpoint(PCWSTR(id.as_ptr()), role)
                .ok()?;
        }
        Ok(())
    }
}
