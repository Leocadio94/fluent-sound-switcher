//! Opt-in companion to the microphone mute: also sends Win+Alt+K, the Windows 11
//! "call mute" shortcut, so an app that integrates it (Teams) mutes itself too.
//!
//! The shortcut is a toggle and the state is not readable, so it can drift from
//! ours if the user mutes inside the app. See docs/mic-mute-scope.md.

use std::time::{Duration, Instant};

use tauri::AppHandle;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
    KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_CONTROL, VK_K, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
};

/// How long to wait for the user's own shortcut to be let go of.
const RELEASE_TIMEOUT: Duration = Duration::from_millis(600);
const POLL: Duration = Duration::from_millis(15);

/// Keys that must be up before the chord goes out: the modifiers of the user's
/// own shortcut, and K itself, in case that shortcut ends on it.
const HELD_KEYS: [VIRTUAL_KEY; 6] = [VK_CONTROL, VK_SHIFT, VK_MENU, VK_LWIN, VK_RWIN, VK_K];

/// Win+Alt+K as (key, is_release) steps: pressed in order, released in reverse.
const CHORD: [(VIRTUAL_KEY, bool); 6] = [
    (VK_LWIN, false),
    (VK_MENU, false),
    (VK_K, false),
    (VK_K, true),
    (VK_MENU, true),
    (VK_LWIN, true),
];

/// Sends Win+Alt+K when the user enabled it, off the calling thread.
pub fn trigger(app: &AppHandle) {
    if !crate::config::mic_mute_call_shortcut(app) {
        return;
    }
    tauri::async_runtime::spawn_blocking(|| {
        // The mute hotkey is usually still down here. Its Ctrl/Shift/Alt would
        // merge into the chord and Windows would see a different shortcut.
        if !wait_for_release() {
            log::warn!("keys still held; skipped the Win+Alt+K call-mute shortcut");
            return;
        }
        send_chord();
    });
}

fn key_down(key: VIRTUAL_KEY) -> bool {
    // The high bit of the returned state is "currently down".
    unsafe { GetAsyncKeyState(i32::from(key.0)) < 0 }
}

fn wait_for_release() -> bool {
    let deadline = Instant::now() + RELEASE_TIMEOUT;
    while HELD_KEYS.iter().any(|&key| key_down(key)) {
        if Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(POLL);
    }
    true
}

fn key_input((key, release): (VIRTUAL_KEY, bool)) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                wScan: 0,
                dwFlags: if release {
                    KEYEVENTF_KEYUP
                } else {
                    KEYBD_EVENT_FLAGS(0)
                },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

fn send_chord() {
    let inputs = CHORD.map(key_input);
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent as usize != inputs.len() {
        // Typically UIPI: an elevated foreground window drops input from a
        // non-elevated process.
        log::warn!(
            "Win+Alt+K: {sent} of {} key events were accepted",
            inputs.len()
        );
    }
}

#[cfg(test)]
mod tests {
    use super::CHORD;

    #[test]
    fn every_key_pressed_is_released_in_reverse_order() {
        let (down, up) = CHORD.split_at(CHORD.len() / 2);
        assert!(down.iter().all(|&(_, release)| !release));
        assert!(up.iter().all(|&(_, release)| release));
        let pressed: Vec<_> = down.iter().map(|&(key, _)| key.0).collect();
        let released: Vec<_> = up.iter().rev().map(|&(key, _)| key.0).collect();
        assert_eq!(pressed, released);
    }
}
