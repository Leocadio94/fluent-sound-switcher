//! Windows Core Audio integration.
//!
//! This module is the isolated, risky part of the app: it talks to the Windows
//! audio stack over COM. `enumerator` lists devices; `policy` switches the
//! default device through the undocumented `IPolicyConfig` interface.

mod enumerator;
mod policy;
mod volume;

pub use enumerator::{list_devices, AudioDevice};
pub use policy::set_default_device;
pub use volume::{is_mic_muted, toggle_mic_mute};
#[allow(unused_imports)]
pub use volume::set_mic_mute;

/// Switches the default device for `direction` ("output"/"input") to the next
/// device in the cycle list, wrapping around.
///
/// `cycle_ids` is the user's curated favorites in order; only active devices in
/// that list are cycled. When the list is empty every active device of the
/// direction is used. Returns the newly-selected device, or `None` if there is
/// nothing to cycle.
pub fn cycle_default(
    direction: &str,
    cycle_ids: &[String],
) -> windows::core::Result<Option<AudioDevice>> {
    let mut devices: Vec<AudioDevice> = list_devices()?
        .into_iter()
        .filter(|d| d.direction == direction)
        .collect();

    let pool: Vec<AudioDevice> = if cycle_ids.is_empty() {
        devices
    } else {
        let mut ordered = Vec::new();
        for id in cycle_ids {
            if let Some(pos) = devices.iter().position(|d| &d.id == id) {
                ordered.push(devices.remove(pos));
            }
        }
        ordered
    };

    if pool.is_empty() {
        return Ok(None);
    }

    let current = pool.iter().position(|d| d.is_default);
    let next_idx = current.map_or(0, |i| (i + 1) % pool.len());
    let next = pool[next_idx].clone();
    set_default_device(&next.id)?;
    Ok(Some(next))
}

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
