//! Device-change notifications: native toast, on-screen banner and/or a short
//! sound, per the user's config.

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::config;
use crate::i18n::{self, Msg};

/// Notifies that the default `direction` device changed to `name`.
pub fn device_changed(app: &AppHandle, name: &str, direction: &str) {
    let cfg = config::notifications(app);

    if cfg.banner {
        crate::banner::show(app, name, direction);
    }

    if cfg.native {
        let label = i18n::t(
            app,
            if direction == "output" {
                Msg::OutputDevice
            } else {
                Msg::InputDevice
            },
        );
        if let Err(e) = app.notification().builder().title(label).body(name).show() {
            log::warn!("native toast failed: {e}");
        }
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
        if !PlaySoundW(
            PCWSTR(WAV.as_ptr() as *const u16),
            HMODULE::default(),
            SND_MEMORY | SND_ASYNC,
        )
        .as_bool()
        {
            log::warn!("PlaySoundW failed for the switch sound");
        }
    }
}

#[cfg(not(windows))]
fn play_sound() {}
