//! Device monitoring via `IMMNotificationClient`. Three jobs:
//!  1. Mirror *external* default-device changes (Windows sound panel, the CLI,
//!     another app) into the open GUI by emitting `device-changed`, so the list
//!     and tray stay current without the user touching our UI.
//!  2. Keep the mute state honest when the default *capture* device changes.
//!  3. Optional auto-switch: when an output device connects (e.g. a TV or
//!     monitor with audio is plugged in), make it the system default per the
//!     user's rule.
//!
//! Every handler here runs on the Windows audio service's thread. Microsoft
//! documents that these callbacks must not block or re-enter COM, and the old
//! code did both: one arrival ran three file reads, two COM enumerations and a
//! default-device switch inline. Handlers now capture what they need and hand
//! the work to a blocking task.

use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};
use windows::core::{implement, Result, PCWSTR};
use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use windows::Win32::Media::Audio::{
    eCapture, eConsole, eRender, EDataFlow, ERole, IMMDeviceEnumerator, IMMNotificationClient,
    IMMNotificationClient_Impl, MMDeviceEnumerator, DEVICE_STATE, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};
use windows::Win32::UI::Shell::PropertiesSystem::PROPERTYKEY;

/// Windows fires property-change notifications in bursts (a rename touches
/// several keys), so collapse them into a single GUI refresh.
const RENAME_DEBOUNCE: Duration = Duration::from_millis(400);

/// How long to wait after a device arrives before auto-switching to it: a
/// Bluetooth endpoint goes ACTIVE mid-handshake and often drops again right
/// after, so grabbing the default immediately starts a switch/revert flap.
const ARRIVAL_SETTLE: Duration = Duration::from_millis(2000);

/// How long to wait before acting on a default change: while the new device
/// settles, Windows can flip the default back, and disconnecting a device the
/// system handed back to would cut a connection the user kept.
const DISCONNECT_SETTLE: Duration = Duration::from_millis(3000);

/// Id of the current default output, remembered so the device that *stopped*
/// being the default can be auto-disconnected when it was Bluetooth.
static LAST_DEFAULT_OUTPUT: OnceLock<Mutex<Option<String>>> = OnceLock::new();

/// Swaps the remembered default-output id, returning the previous one.
fn remember_default_output(new_id: Option<String>) -> Option<String> {
    let cell = LAST_DEFAULT_OUTPUT.get_or_init(|| Mutex::new(None));
    match cell.lock() {
        Ok(mut guard) => std::mem::replace(&mut *guard, new_id),
        Err(_) => None,
    }
}

/// COM callback object. Holds an `AppHandle` so the audio thread can dispatch
/// work and notify the frontend.
#[implement(IMMNotificationClient)]
struct Notifier {
    app: AppHandle,
}

/// Moves `job` off the audio service's callback thread. The work is blocking
/// (COM + file IO), so it goes to the blocking pool rather than the async one.
fn dispatch<F>(app: &AppHandle, job: F)
where
    F: FnOnce(AppHandle) + Send + 'static,
{
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || job(app));
}

fn refresh_gui(app: &AppHandle) {
    if let Err(e) = app.emit("device-changed", ()) {
        log::warn!("could not emit device-changed: {e}");
    }
}

impl IMMNotificationClient_Impl for Notifier_Impl {
    fn OnDefaultDeviceChanged(&self, flow: EDataFlow, role: ERole, id: &PCWSTR) -> Result<()> {
        // Console role only, so one change does not fire three times.
        if role != eConsole {
            return Ok(());
        }
        let is_render = flow == eRender;
        let is_capture = flow == eCapture;
        let new_id = unsafe { id.to_string() }.ok().filter(|id| !id.is_empty());
        dispatch(&self.app, move |app| {
            refresh_gui(&app);
            if is_render {
                // The output default moved — schedule the previous device's
                // auto-disconnect if the user left it behind on Bluetooth
                // (after a settle window), refresh the device tray icon, move
                // the volume callback to the new endpoint (it is bound to one
                // device) and re-read that device's mute state.
                schedule_auto_disconnect(&app, handle_default_output_change(new_id));
                crate::tray::refresh_device_icon(&app);
                crate::audio::volume_events::rearm(&app);
                crate::mute::refresh_output(&app);
            }
            if is_capture {
                // The default mic moved. `MuteState` still held the *previous*
                // device's state, so the tray icon and the overlay reported a
                // mute status belonging to a microphone no longer in use.
                crate::mute::refresh(&app);
            }
        });
        Ok(())
    }

    fn OnDeviceAdded(&self, id: &PCWSTR) -> Result<()> {
        schedule_arrival(&self.app, id);
        Ok(())
    }

    fn OnDeviceStateChanged(&self, id: &PCWSTR, new_state: DEVICE_STATE) -> Result<()> {
        if new_state == DEVICE_STATE_ACTIVE {
            schedule_arrival(&self.app, id);
        } else {
            // A device went away / was disabled; refresh the GUI list.
            dispatch(&self.app, |app| refresh_gui(&app));
        }
        Ok(())
    }

    fn OnDeviceRemoved(&self, _id: &PCWSTR) -> Result<()> {
        dispatch(&self.app, |app| refresh_gui(&app));
        Ok(())
    }

    fn OnPropertyValueChanged(&self, _id: &PCWSTR, key: &PROPERTYKEY) -> Result<()> {
        // Renaming a device in the sound panel used to leave the old name in
        // our list until something else forced a refresh.
        if *key == PKEY_Device_FriendlyName && rename_debounce_passed() {
            dispatch(&self.app, |app| refresh_gui(&app));
        }
        Ok(())
    }
}

/// True at most once per [`RENAME_DEBOUNCE`].
fn rename_debounce_passed() -> bool {
    static LAST: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();
    let Ok(mut last) = LAST.get_or_init(|| Mutex::new(None)).lock() else {
        return false;
    };
    let now = Instant::now();
    match *last {
        Some(previous) if now.duration_since(previous) < RENAME_DEBOUNCE => false,
        _ => {
            *last = Some(now);
            true
        }
    }
}

/// Reads the device id out of the callback and hands the arrival off the audio
/// thread. Anything needing COM or the config file happens in [`on_arrival`].
fn schedule_arrival(app: &AppHandle, id: &PCWSTR) {
    let device_id = match unsafe { id.to_string() } {
        Ok(id) if !id.is_empty() => id,
        _ => return,
    };
    dispatch(app, move |app| on_arrival(&app, &device_id));
}

/// Handles a default-output change: remembers the new id and, when the user
/// enabled it and the device that *stopped* being the default is Bluetooth,
/// disconnects it — speakers left connected (and blinking) behind after a
/// switch are the whole reason the setting exists.
///
/// Covers every switch path (app, hotkey, CLI, sound panel, auto-switch),
/// because they all land in `OnDefaultDeviceChanged`. Runs in a blocking
/// task, never in the COM callback itself.
///
/// Returns the remembered previous id (the caller hands it to
/// [`schedule_auto_disconnect`]) so the switch bookkeeping happens here while
/// the wait-and-disconnect runs in its own task — otherwise the settle sleep
/// would delay the tray/volume refreshes that follow.
fn handle_default_output_change(new_id: Option<String>) -> Option<String> {
    remember_default_output(new_id)
}

/// Schedules the previous default output's disconnect when it was Bluetooth
/// and the user enabled the option. The disconnect itself runs after
/// [`DISCONNECT_SETTLE`] and is skipped if the default flipped back to the
/// device meanwhile: during a connect's handshake Windows can revert the
/// default for a moment, and cutting the connection then is exactly the
/// "reconnect rejects itself" flap.
fn schedule_auto_disconnect(app: &AppHandle, old_id: Option<String>) {
    let Some(old_id) = old_id else {
        return;
    };
    if !crate::config::bluetooth_auto_disconnect(app) {
        return;
    }
    let Ok(devices) = crate::audio::list_devices() else {
        return;
    };
    let Some(device) = devices.iter().find(|d| d.id == old_id && d.is_bluetooth) else {
        return;
    };
    let Some(mac) = device.bt_mac.clone() else {
        return;
    };
    let name = device.name.clone();
    dispatch(app, move |app| {
        std::thread::sleep(DISCONNECT_SETTLE);
        let switched_away = crate::audio::list_devices()
            .ok()
            .and_then(|devices| {
                devices
                    .iter()
                    .find(|d| d.is_default)
                    .map(|d| d.id != old_id)
            })
            .unwrap_or(false);
        if !switched_away {
            log::info!("default flipped back to {name}; skipping the auto-disconnect");
            return;
        }
        match crate::audio::bluetooth::set_connect(&mac, false) {
            Ok(()) => {
                log::info!("auto-disconnected the previous Bluetooth output {name}");
                crate::notify::device_disconnected(&app, &name);
            }
            Err(e) => log::warn!("auto-disconnect of {name} failed: {e}"),
        }
    });
}

/// Handles a device becoming available: always refresh the GUI, and, when the
/// user enabled auto-switch and the rule allows it, make the device the default
/// output. Setting the default re-enters `OnDefaultDeviceChanged` (which only
/// dispatches a refresh), so there is no switch loop. Switching to the
/// already-default device is skipped, so the add + state-changed double event is
/// idempotent.
fn on_arrival(app: &AppHandle, device_id: &str) {
    let cfg = crate::config::auto_switch(app);
    if !cfg.enabled {
        refresh_gui(app);
        return;
    }

    let devices = match crate::audio::list_devices() {
        Ok(devices) => devices,
        Err(e) => {
            log::warn!("could not enumerate devices on arrival: {e}");
            refresh_gui(app);
            return;
        }
    };
    let Some(device) = devices.iter().find(|d| d.id == device_id) else {
        // Not active/enumerable yet — still let the GUI catch up.
        refresh_gui(app);
        return;
    };

    // Only outputs auto-switch, and never if it is already the default.
    if device.direction != "output" || device.is_default {
        refresh_gui(app);
        return;
    }

    let allowed = match cfg.mode.as_str() {
        "any" => true,
        // "favoritesOnly": the device must be a curated output favorite.
        _ => crate::config::favorites(app, "output").contains(&device.id),
    };
    if !allowed {
        refresh_gui(app);
        return;
    }

    // A Bluetooth endpoint goes ACTIVE mid-handshake and often drops again a
    // moment later; taking the default immediately starts a switch/revert
    // flap (and the auto-disconnect then acts on the revert). Give it the
    // settle window and re-verify it is still available before taking over.
    std::thread::sleep(ARRIVAL_SETTLE);
    let Ok(devices) = crate::audio::list_devices() else {
        refresh_gui(app);
        return;
    };
    let Some(device) = devices.iter().find(|d| d.id == device_id) else {
        // Gone again — this was a handshake blip, not a real arrival.
        log::info!("device {device_id} dropped during the settle window; not auto-switching");
        refresh_gui(app);
        return;
    };
    if device.direction != "output" || !device.is_available() || device.is_default {
        refresh_gui(app);
        return;
    }

    match crate::audio::set_default_device(device_id) {
        Ok(()) => {
            log::info!("auto-switched output to {} ({device_id})", device.name);
            refresh_gui(app);
            crate::notify::device_changed(app, &device.name, "output");
        }
        Err(e) => log::error!("auto-switch to {} failed: {e}", device.name),
    }
}

/// Registers the endpoint-notification callback for the process lifetime. The
/// enumerator and client are intentionally leaked: the registration must
/// outlive this call and we never unregister (process lifetime == app lifetime),
/// which also sidesteps the COM objects' non-`Send`/`Sync` nature.
pub fn start(app: &AppHandle) {
    crate::audio::ensure_com();
    // Seed the remembered default so the first switch after launch does not
    // fire with an empty history. The enumeration may legitimately fail (no
    // output device) — an empty history just skips the first auto-disconnect.
    if let Ok(default) = crate::audio::default_output() {
        remember_default_output(default.map(|d| d.id));
    }
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            match CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) {
                Ok(e) => e,
                Err(e) => {
                    log::error!("device-notification enumerator creation failed: {e}");
                    return;
                }
            };
        let client: IMMNotificationClient = Notifier { app: app.clone() }.into();
        if let Err(e) = enumerator.RegisterEndpointNotificationCallback(&client) {
            log::error!(
                "endpoint-notification registration failed: {e}; \
                 external device changes will not be mirrored"
            );
            return;
        }
        std::mem::forget(client);
        std::mem::forget(enumerator);
    }
}
