//! Windows Core Audio integration.
//!
//! This module is the isolated, risky part of the app: it talks to the Windows
//! audio stack over COM. `enumerator` lists devices; `policy` switches the
//! default device through the undocumented `IPolicyConfig` interface.

mod enumerator;
mod policy;

pub use enumerator::{list_devices, AudioDevice};
pub use policy::set_default_device;

use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

/// Initializes COM on the current thread. Safe to call repeatedly: if COM is
/// already initialized (possibly in a different apartment, as Tauri's main
/// thread is STA), the returned `S_FALSE`/`RPC_E_CHANGED_MODE` is ignored and
/// the existing apartment is reused — the audio interfaces work in either.
pub fn ensure_com() {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
}
