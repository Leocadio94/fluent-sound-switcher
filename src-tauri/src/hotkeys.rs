//! Global hotkeys: cycle output/input devices and toggle the mic mute.
//!
//! Bindings come from the frontend store (`config.json`); we register them as
//! global shortcuts and dispatch the mapped action when fired. The action map
//! lives in managed state so it can be rebuilt when the user edits a binding.

use std::collections::HashMap;
use std::str::FromStr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::config::{self, HotkeyConfig};

#[derive(Clone, Copy, PartialEq)]
pub enum Action {
    CycleOutput,
    CycleInput,
    ToggleMute,
    VolumeUp,
    VolumeDown,
    ToggleOutputMute,
}

impl Action {
    /// The `hotkeys` config key this action is bound to. Doubles as the id the
    /// frontend uses to attach a failure to the right field.
    fn key(self) -> &'static str {
        match self {
            Action::CycleOutput => "cycleOutput",
            Action::CycleInput => "cycleInput",
            Action::ToggleMute => "toggleMute",
            Action::VolumeUp => "volumeUp",
            Action::VolumeDown => "volumeDown",
            Action::ToggleOutputMute => "toggleOutputMute",
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

/// Pause before a held volume key starts repeating, and the gap between steps.
const HOLD_DELAY: Duration = Duration::from_millis(400);
const HOLD_INTERVAL: Duration = Duration::from_millis(70);
/// A release that never arrives must not leave the volume running away.
const HOLD_MAX: Duration = Duration::from_secs(20);

/// Identifies the newest held volume key; a release or a new press bumps it,
/// which ends the repeat loop of the one before.
fn hold_generation() -> &'static AtomicU64 {
    static G: OnceLock<AtomicU64> = OnceLock::new();
    G.get_or_init(|| AtomicU64::new(0))
}

/// Called by the plugin handler for every shortcut event.
pub fn handle_event(app: &AppHandle, shortcut: &Shortcut, state: ShortcutState) {
    let action = lock(&app.state::<HotkeyState>()).get(shortcut).copied();
    let Some(action) = action else {
        return;
    };
    match (state, action) {
        (ShortcutState::Pressed, Action::VolumeUp) => hold_volume(app, true),
        (ShortcutState::Pressed, Action::VolumeDown) => hold_volume(app, false),
        (ShortcutState::Pressed, _) => perform(app.clone(), action),
        (ShortcutState::Released, Action::VolumeUp | Action::VolumeDown) => {
            hold_generation().fetch_add(1, Ordering::SeqCst);
        }
        (ShortcutState::Released, _) => {}
    }
}

/// One step right away, then, if the key is still down after `HOLD_DELAY`, a step
/// every `HOLD_INTERVAL` until it is released or the volume hits the end.
///
/// The OS reports a held shortcut as a single press (`MOD_NOREPEAT`), and the
/// release as a separate event, so the repeat has to be driven from here.
fn hold_volume(app: &AppHandle, up: bool) {
    let id = hold_generation().fetch_add(1, Ordering::SeqCst) + 1;
    perform(
        app.clone(),
        if up {
            Action::VolumeUp
        } else {
            Action::VolumeDown
        },
    );

    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(HOLD_DELAY);
        let started = Instant::now();
        while hold_generation().load(Ordering::SeqCst) == id && started.elapsed() < HOLD_MAX {
            match step_volume(&app, up) {
                Some(level) if at_limit(level, up) => break,
                Some(_) => {}
                None => break,
            }
            thread::sleep(HOLD_INTERVAL);
        }
    });
}

/// Whether a step in this direction can do nothing more.
fn at_limit(level: f32, up: bool) -> bool {
    if up {
        level >= 0.999
    } else {
        level <= 0.001
    }
}

/// Runs an action off the UI thread. Shared by the global-shortcut handler and
/// the gamepad poller.
pub(crate) fn perform(app: AppHandle, action: Action) {
    // Run the COM work off the UI thread; emit results for the frontend.
    tauri::async_runtime::spawn(async move {
        match action {
            Action::CycleOutput => cycle(&app, "output"),
            Action::CycleInput => cycle(&app, "input"),
            Action::ToggleMute => crate::mute::toggle(&app),
            Action::VolumeUp => {
                step_volume(&app, true);
            }
            Action::VolumeDown => {
                step_volume(&app, false);
            }
            Action::ToggleOutputMute => crate::mute::toggle_output(&app),
        }
    });
}

/// Nudges the default output one step and shows the volume OSD. Returns the new
/// level, or `None` when the step failed.
fn step_volume(app: &AppHandle, up: bool) -> Option<f32> {
    match crate::audio::step_volume(None, "output", up) {
        Ok(level) => {
            crate::overlay::show_volume(app, level);
            Some(level)
        }
        Err(e) => {
            log::error!("could not step the output volume: {e}");
            None
        }
    }
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
        (&cfg.volume_up, Action::VolumeUp),
        (&cfg.volume_down, Action::VolumeDown),
        (&cfg.toggle_output_mute, Action::ToggleOutputMute),
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

#[cfg(test)]
mod tests {
    use super::at_limit;

    #[test]
    fn a_held_key_stops_at_the_end_it_is_heading_for() {
        assert!(at_limit(1.0, true));
        assert!(at_limit(0.0, false));
        // Held the other way from where it sits, the step still does something.
        assert!(!at_limit(1.0, false));
        assert!(!at_limit(0.0, true));
        assert!(!at_limit(0.5, true));
    }
}
