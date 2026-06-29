//! Global hotkeys: cycle output/input devices and toggle the mic mute.
//!
//! Bindings come from the frontend store (`config.json`); we register them as
//! global shortcuts and dispatch the mapped action when fired. The action map
//! lives in managed state so it can be rebuilt when the user edits a binding.

use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::config::{self, HotkeyConfig};

#[derive(Clone, Copy)]
pub enum Action {
    CycleOutput,
    CycleInput,
    ToggleMute,
}

/// Maps each registered shortcut to the action it triggers.
#[derive(Default)]
pub struct HotkeyState {
    map: Mutex<HashMap<Shortcut, Action>>,
}

/// Called by the plugin handler for every shortcut event.
pub fn handle_event(app: &AppHandle, shortcut: &Shortcut, state: ShortcutState) {
    if state != ShortcutState::Pressed {
        return;
    }
    let action = app
        .state::<HotkeyState>()
        .map
        .lock()
        .ok()
        .and_then(|m| m.get(shortcut).copied());
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
    if let Ok(Some(device)) = crate::audio::cycle_default(direction, &favorites) {
        let _ = app.emit("device-changed", &device);
        crate::notify::device_changed(app, &device.name, device.direction);
    }
}

/// Registers the given bindings, replacing any previously registered ones.
pub fn register_with(app: &AppHandle, cfg: &HotkeyConfig) -> tauri::Result<()> {
    let global = app.global_shortcut();
    let state = app.state::<HotkeyState>();
    let mut map = state.map.lock().expect("hotkey map poisoned");

    for shortcut in map.keys().copied().collect::<Vec<_>>() {
        let _ = global.unregister(shortcut);
    }
    map.clear();

    let entries = [
        (&cfg.cycle_output, Action::CycleOutput),
        (&cfg.cycle_input, Action::CycleInput),
        (&cfg.toggle_mute, Action::ToggleMute),
    ];
    for (accelerator, action) in entries {
        if accelerator.is_empty() {
            continue;
        }
        let Ok(shortcut) = Shortcut::from_str(accelerator) else {
            continue;
        };
        if global.register(shortcut).is_ok() {
            map.insert(shortcut, action);
        }
    }
    Ok(())
}

/// Registers the bindings currently stored in `config.json` (startup path).
pub fn register_all(app: &AppHandle) -> tauri::Result<()> {
    let cfg = config::hotkeys(app);
    register_with(app, &cfg)
}
