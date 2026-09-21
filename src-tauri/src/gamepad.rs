//! Gamepad shortcuts (XInput): while the chord (LB + RB) is held, A/B/X/Y and
//! the D-pad trigger the same actions as the keyboard hotkeys.
//!
//! A plain polling loop over `XInputGetState` — user-mode, read-only, official
//! API — was chosen over anything that consumes or hooks input (ViGEm, HID
//! filters, SendInput): those are what anti-cheats flag. The trade-off is that
//! the game still sees the chord buttons; LB+RB together is rare in gameplay,
//! and the whole feature is off by default anyway. The Guide/Home button is
//! reserved by the system and never reported by XInput, so it cannot be the
//! chord.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use tauri::Manager;
use windows::Win32::UI::Input::XboxController::{
    XInputGetState, XINPUT_GAMEPAD_A, XINPUT_GAMEPAD_B, XINPUT_GAMEPAD_BUTTON_FLAGS,
    XINPUT_GAMEPAD_DPAD_DOWN, XINPUT_GAMEPAD_DPAD_UP, XINPUT_GAMEPAD_LEFT_SHOULDER,
    XINPUT_GAMEPAD_RIGHT_SHOULDER, XINPUT_GAMEPAD_X, XINPUT_GAMEPAD_Y, XINPUT_STATE,
};

use crate::hotkeys::Action;

/// Player 1 only: shortcuts are for the person at the machine, not for a
/// second controller mid-game.
const PLAYER_INDEX: u32 = 0;
/// Poll interval. Fast enough to feel instant, cheap enough to never matter.
const POLL_INTERVAL: Duration = Duration::from_millis(30);
/// The chord must be held this long before action buttons arm, so a moment
/// where LB and RB cross paths during normal play does not fire anything.
const CHORD_ARM_DELAY: Duration = Duration::from_millis(80);

/// Buttons that can trigger an action while the chord is armed.
const ACTION_BUTTONS: &[(XINPUT_GAMEPAD_BUTTON_FLAGS, Action)] = &[
    (XINPUT_GAMEPAD_A, Action::CycleOutput),
    (XINPUT_GAMEPAD_B, Action::CycleInput),
    (XINPUT_GAMEPAD_X, Action::ToggleMute),
    (XINPUT_GAMEPAD_Y, Action::ToggleOutputMute),
    (XINPUT_GAMEPAD_DPAD_UP, Action::VolumeUp),
    (XINPUT_GAMEPAD_DPAD_DOWN, Action::VolumeDown),
];

/// The chord: both bumpers held together.
const CHORD: XINPUT_GAMEPAD_BUTTON_FLAGS =
    XINPUT_GAMEPAD_BUTTON_FLAGS(XINPUT_GAMEPAD_LEFT_SHOULDER.0 | XINPUT_GAMEPAD_RIGHT_SHOULDER.0);

/// Shared between the UI thread (config updates) and the polling thread.
pub struct GamepadState {
    /// Mirrors `gamepadHotkeys.enabled` from `config.json`; the polling thread
    /// skips its work (but keeps running) while this is false.
    enabled: AtomicBool,
    /// Bumped on every config change so the thread resets its edge detection.
    generation: AtomicU64,
}

impl GamepadState {
    fn new() -> Self {
        Self {
            enabled: AtomicBool::new(false),
            generation: AtomicU64::new(0),
        }
    }

    /// Applies a new enabled flag. Used both at startup (from the stored
    /// config) and live (from the `update_gamepad_hotkeys` command).
    pub fn set(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::Relaxed);
        self.generation.fetch_add(1, Ordering::Relaxed);
    }
}

/// Edge-detection carried between polls.
struct PollState {
    buttons: XINPUT_GAMEPAD_BUTTON_FLAGS,
    chord_since: Option<Instant>,
    /// Actions fired since the chord armed; cleared when the chord releases.
    fired: Vec<Action>,
}

impl PollState {
    fn new() -> Self {
        Self {
            buttons: XINPUT_GAMEPAD_BUTTON_FLAGS(0),
            chord_since: None,
            fired: Vec::new(),
        }
    }
}

fn poll_once(app: &tauri::AppHandle, state: &mut PollState) {
    let mut xinput = XINPUT_STATE::default();
    // ERROR_SUCCESS == 0; any other value means the slot is empty.
    let result = unsafe { XInputGetState(PLAYER_INDEX, &mut xinput) };
    if result != 0 {
        *state = PollState::new();
        return;
    }

    let buttons = xinput.Gamepad.wButtons;
    let chord_held = (buttons & CHORD) == CHORD;

    match (state.chord_since, chord_held) {
        (None, true) => state.chord_since = Some(Instant::now()),
        // Chord released (or lost a button): reset so nothing half-armed fires.
        (Some(_), false) => {
            state.chord_since = None;
            state.fired.clear();
        }
        _ => {}
    }

    let Some(since) = state.chord_since else {
        state.buttons = buttons;
        return;
    };
    if since.elapsed() < CHORD_ARM_DELAY {
        state.buttons = buttons;
        return;
    }

    let pressed = buttons & !state.buttons;
    for (flag, action) in ACTION_BUTTONS {
        if (pressed & *flag) == *flag && !state.fired.contains(action) {
            state.fired.push(*action);
            crate::hotkeys::perform(app.clone(), *action);
        }
    }

    state.buttons = buttons;
}

/// Runs the polling loop until the process exits. The thread always runs; when
/// disabled it idles cheaply instead of polling XInput.
fn run(app: tauri::AppHandle) {
    let state = app.state::<Arc<GamepadState>>();
    let mut poll = PollState::new();
    let mut seen_generation = state.generation.load(Ordering::Relaxed);
    let mut logged_missing = false;
    loop {
        let generation = state.generation.load(Ordering::Relaxed);
        if generation != seen_generation {
            seen_generation = generation;
            poll = PollState::new();
            logged_missing = false;
        }

        if state.enabled.load(Ordering::Relaxed) {
            poll_once(&app, &mut poll);
            // Mention an absent controller once per enable, not every 30ms.
            if !logged_missing {
                let mut probe = XINPUT_STATE::default();
                let present = unsafe { XInputGetState(PLAYER_INDEX, &mut probe) } == 0;
                if !present {
                    log::info!("gamepad shortcuts enabled, but no controller on slot 1");
                }
                logged_missing = true;
            }
            thread::sleep(POLL_INTERVAL);
        } else {
            thread::sleep(Duration::from_millis(250));
        }
    }
}

/// Spawns the polling thread (once) and applies the stored config.
pub fn start(app: &tauri::AppHandle) {
    let state = Arc::new(GamepadState::new());
    state.set(crate::config::gamepad_hotkeys(app).enabled);
    app.manage(state);
    let handle = app.clone();
    thread::Builder::new()
        .name("gamepad-poll".into())
        .spawn(move || run(handle))
        .map(|_| ())
        .unwrap_or_else(|e| log::error!("could not spawn the gamepad thread: {e}"));
}
