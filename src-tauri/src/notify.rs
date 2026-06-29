//! Device-change notifications: native toast, on-screen banner and/or a short
//! sound, per the user's config.

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::config;

/// Notifies that the default `direction` device changed to `name`.
pub fn device_changed(app: &AppHandle, name: &str, direction: &str) {
    let cfg = config::notifications(app);

    if cfg.banner {
        crate::banner::show(app, name, direction);
    }

    if cfg.native {
        let label = if direction == "output" {
            "Dispositivo de saída"
        } else {
            "Dispositivo de entrada"
        };
        let _ = app
            .notification()
            .builder()
            .title(label)
            .body(name)
            .show();
    }

    if cfg.sound {
        play_sound();
    }
}

#[cfg(windows)]
fn play_sound() {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::HMODULE;
    use windows::Win32::Media::Audio::{PlaySoundW, SND_ASYNC, SND_MEMORY};

    const WAV: &[u8] = include_bytes!("../sounds/switch.wav");
    unsafe {
        let _ = PlaySoundW(
            PCWSTR(WAV.as_ptr() as *const u16),
            HMODULE::default(),
            SND_MEMORY | SND_ASYNC,
        );
    }
}

#[cfg(not(windows))]
fn play_sound() {}
