//! Global hotkeys: cycle output/input devices and toggle the mic mute.
//!
//! Bindings come from the frontend store (`config.json`); we register them as
//! global shortcuts and dispatch the mapped action when fired. The action map
//! lives in managed state so it can be rebuilt when the user edits a binding.

use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Mutex, MutexGuard};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::config::{self, HotkeyConfig};

#[derive(Clone, Copy)]
pub enum Action {
    CycleOutput,
    CycleInput,
    ToggleMute,
}

impl Action {
    /// The `hotkeys` config key this action is bound to. Doubles as the id the
    /// frontend uses to attach a failure to the right field.
    fn key(self) -> &'static str {
        match self {
            Action::CycleOutput => "cycleOutput",
            Action::CycleInput => "cycleInput",
            Action::ToggleMute => "toggleMute",
        }
    }
}

/// A binding that could not be registered — most often because another app
/// already owns the combination. Reported back to the frontend so the user
/// stops believing a dead shortcut works.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyFailure {
    /// The `hotkeys` config key (e.g. `cycleOutput`).
    pub action: String,
    pub accelerator: String,
    pub reason: String,
}

/// Maps each registered shortcut to the action it triggers.
#[derive(Default)]
pub struct HotkeyState {
    map: Mutex<HashMap<Shortcut, Action>>,
}

/// Locks the action map, recovering from a poisoned mutex instead of aborting:
/// the release profile uses `panic = "abort"`, so an `expect` here would take
/// the whole process down over a hotkey.
fn lock(state: &HotkeyState) -> MutexGuard<'_, HashMap<Shortcut, Action>> {
    match state.map.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            log::error!("hotkey map mutex was poisoned; recovering");
            poisoned.into_inner()
        }
    }
}

/// Called by the plugin handler for every shortcut event.
pub fn handle_event(app: &AppHandle, shortcut: &Shortcut, state: ShortcutState) {
    if state != ShortcutState::Pressed {
        return;
    }
    let action = lock(&app.state::<HotkeyState>()).get(shortcut).copied();
    if let Some(action) = action {
        perform(app.clone(), action);
    }
}

fn perform(app: AppHandle, action: Action) {
    // Run the COM work off the UI thread; emit results for the frontend.
    tauri::async_runtime::spawn(async move {
        match action {
            Action::CycleOutput => cycle(&app, "output"),
            Action::CycleInput => cycle(&app, "input"),
            Action::ToggleMute => crate::mute::toggle(&app),
        }
    });
}

fn cycle(app: &AppHandle, direction: &str) {
    let favorites = config::favorites(app, direction);
    match crate::audio::cycle_default(direction, &favorites) {
        Ok(Some(device)) => {
            if let Err(e) = app.emit("device-changed", &device) {
                log::warn!("could not emit device-changed: {e}");
            }
            crate::notify::device_changed(app, &device.name, device.direction);
        }
        Ok(None) => log::debug!("cycle {direction}: no candidate device"),
        Err(e) => log::error!("cycle {direction} failed: {e}"),
    }
}

/// Registers the given bindings, replacing any previously registered ones.
/// Returns the bindings that could *not* be registered — the caller surfaces
/// them to the user; an empty vec means everything took.
pub fn register_with(app: &AppHandle, cfg: &HotkeyConfig) -> tauri::Result<Vec<HotkeyFailure>> {
    let global = app.global_shortcut();
    let state = app.state::<HotkeyState>();

    // Drain the current bindings under the lock, then release it before talking
    // to the OS: `unregister`/`register` block, and the plugin's own handler
    // needs this same lock to dispatch an incoming shortcut.
    let previous: Vec<Shortcut> = {
        let mut map = lock(&state);
        let keys = map.keys().copied().collect();
        map.clear();
        keys
    };
    for shortcut in previous {
        if let Err(e) = global.unregister(shortcut) {
            log::warn!("could not unregister a previous shortcut: {e}");
        }
    }

    let entries = [
        (&cfg.cycle_output, Action::CycleOutput),
        (&cfg.cycle_input, Action::CycleInput),
        (&cfg.toggle_mute, Action::ToggleMute),
    ];

    let mut registered = Vec::new();
    let mut failures = Vec::new();
    for (accelerator, action) in entries {
        if accelerator.is_empty() {
            continue;
        }
        let shortcut = match Shortcut::from_str(accelerator) {
            Ok(shortcut) => shortcut,
            Err(e) => {
                failures.push(HotkeyFailure {
                    action: action.key().to_string(),
                    accelerator: accelerator.clone(),
                    reason: format!("invalid accelerator: {e}"),
                });
                continue;
            }
        };
        match global.register(shortcut) {
            Ok(()) => registered.push((shortcut, action)),
            Err(e) => failures.push(HotkeyFailure {
                action: action.key().to_string(),
                accelerator: accelerator.clone(),
                // Usually "already registered" — another app owns the combo.
                reason: e.to_string(),
            }),
        }
    }

    lock(&state).extend(registered);
    Ok(failures)
}

/// Registers the bindings currently stored in `config.json` (startup path).
pub fn register_all(app: &AppHandle) -> tauri::Result<Vec<HotkeyFailure>> {
    let cfg = config::hotkeys(app);
    register_with(app, &cfg)
}
