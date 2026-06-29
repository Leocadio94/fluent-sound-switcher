//! Device-arrival monitoring via `IMMNotificationClient`. Two jobs:
//!  1. Mirror *external* default-device changes (Windows sound panel, the CLI,
//!     another app) into the open GUI by emitting `device-changed`, so the list
//!     and tray stay current without the user touching our UI.
//!  2. Optional auto-switch: when an output device connects (e.g. a TV or
//!     monitor with audio is plugged in), make it the system default per the
//!     user's rule.

use tauri::{AppHandle, Emitter};
use windows::core::{implement, Result, PCWSTR};
use windows::Win32::Media::Audio::{
    eConsole, EDataFlow, ERole, IMMDeviceEnumerator, IMMNotificationClient,
    IMMNotificationClient_Impl, MMDeviceEnumerator, DEVICE_STATE, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};
use windows::Win32::UI::Shell::PropertiesSystem::PROPERTYKEY;

/// COM callback object. Holds an `AppHandle` so the audio thread can switch the
/// default device and notify the frontend.
#[implement(IMMNotificationClient)]
struct Notifier {
    app: AppHandle,
}

impl IMMNotificationClient_Impl for Notifier_Impl {
    fn OnDefaultDeviceChanged(
        &self,
        _flow: EDataFlow,
        role: ERole,
        _id: &PCWSTR,
    ) -> Result<()> {
        // The default changed under us (sound panel, CLI, our own switch...).
        // Mirror it to the GUI. Console role only, to avoid firing three times.
        if role == eConsole {
            let _ = self.app.emit("device-changed", ());
        }
        Ok(())
    }

    fn OnDeviceAdded(&self, id: &PCWSTR) -> Result<()> {
        on_arrival(&self.app, id);
        Ok(())
    }

    fn OnDeviceStateChanged(&self, id: &PCWSTR, new_state: DEVICE_STATE) -> Result<()> {
        if new_state == DEVICE_STATE_ACTIVE {
            on_arrival(&self.app, id);
        } else {
            // A device went away / was disabled; refresh the GUI list.
            let _ = self.app.emit("device-changed", ());
        }
        Ok(())
    }

    fn OnDeviceRemoved(&self, _id: &PCWSTR) -> Result<()> {
        let _ = self.app.emit("device-changed", ());
        Ok(())
    }

    fn OnPropertyValueChanged(&self, _id: &PCWSTR, _key: &PROPERTYKEY) -> Result<()> {
        Ok(())
    }
}

/// Handles a device becoming available: always refresh the GUI, and, when the
/// user enabled auto-switch and the rule allows it, make the device the default
/// output. Setting the default re-enters `OnDefaultDeviceChanged` (which only
/// emits), so there is no switch loop. Switching to the already-default device
/// is skipped, so the add + state-changed double event is idempotent.
fn on_arrival(app: &AppHandle, id: &PCWSTR) {
    let device_id = match unsafe { id.to_string() } {
        Ok(s) if !s.is_empty() => s,
        _ => return,
    };

    let refresh = || {
        let _ = app.emit("device-changed", ());
    };

    let cfg = crate::config::auto_switch(app);
    if !cfg.enabled {
        refresh();
        return;
    }

    let Ok(devices) = crate::audio::list_devices() else {
        refresh();
        return;
    };
    let Some(device) = devices.iter().find(|d| d.id == device_id) else {
        // Not active/enumerable yet — still let the GUI catch up.
        refresh();
        return;
    };

    // Only outputs auto-switch, and never if it is already the default.
    if device.direction != "output" || device.is_default {
        refresh();
        return;
    }

    let allowed = match cfg.mode.as_str() {
        "any" => true,
        // "favoritesOnly": the device must be a curated output favorite.
        _ => crate::config::favorites(app, "output").contains(&device_id),
    };
    if !allowed {
        refresh();
        return;
    }

    if crate::audio::set_default_device(&device_id).is_ok() {
        refresh();
        crate::notify::device_changed(app, &device.name, "output");
    }
}

/// Registers the endpoint-notification callback for the process lifetime. The
/// enumerator and client are intentionally leaked: the registration must
/// outlive this call and we never unregister (process lifetime == app lifetime),
/// which also sidesteps the COM objects' non-`Send`/`Sync` nature.
pub fn start(app: &AppHandle) {
    crate::audio::ensure_com();
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            match CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) {
                Ok(e) => e,
                Err(e) => {
                    eprintln!("[events] enumerator creation failed: {e}");
                    return;
                }
            };
        let client: IMMNotificationClient = Notifier { app: app.clone() }.into();
        if let Err(e) = enumerator.RegisterEndpointNotificationCallback(&client) {
            eprintln!("[events] callback registration failed: {e}");
            return;
        }
        std::mem::forget(client);
        std::mem::forget(enumerator);
    }
}
