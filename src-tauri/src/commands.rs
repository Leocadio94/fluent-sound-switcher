//! Tauri commands — the bridge invoked from the frontend.

use crate::audio::{self, AudioDevice};
use crate::config::{HotkeyConfig, MuteIndicator};
use crate::hotkeys;

/// Returns all active input/output devices with the current defaults marked.
#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
    audio::list_devices().map_err(|e| e.to_string())
}

/// Switches the system default device to `device_id` (all roles). When `notify`
/// is set (hotkey/flyout switches), fires a device-change notification.
#[tauri::command]
pub fn set_default_audio_device(
    app: tauri::AppHandle,
    device_id: String,
    notify: bool,
) -> Result<(), String> {
    audio::set_default_device(&device_id).map_err(|e| e.to_string())?;
    if notify {
        if let Ok(devices) = audio::list_devices() {
            if let Some(device) = devices.iter().find(|d| d.id == device_id) {
                crate::notify::device_changed(&app, &device.name, device.direction);
            }
        }
    }
    Ok(())
}

/// Triggers a sample notification so the user can preview their settings.
#[tauri::command]
pub fn preview_notification(app: tauri::AppHandle) {
    crate::notify::device_changed(&app, "Headset", "output");
}

/// Whether the app is registered to start with Windows.
#[tauri::command]
pub fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

/// Enables/disables starting the app with Windows.
#[tauri::command]
pub fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    if enabled {
        manager.enable()
    } else {
        manager.disable()
    }
    .map_err(|e| e.to_string())
}

/// Toggles the default microphone mute, returning the new muted state. Updates
/// the tray icon and overlay too.
#[tauri::command]
pub fn toggle_mic_mute(app: tauri::AppHandle) -> Result<bool, String> {
    let muted = audio::toggle_mic_mute().map_err(|e| e.to_string())?;
    crate::mute::apply(&app, muted);
    Ok(muted)
}

/// Re-applies the overlay with the given settings (passed directly to avoid
/// racing the store's async write).
#[tauri::command]
pub fn refresh_mute_indicator(app: tauri::AppHandle, indicator: MuteIndicator) -> Result<(), String> {
    crate::overlay::update_with(&app, crate::mute::current(&app), &indicator);
    Ok(())
}

/// Resizes the quick-switch flyout to fit its content (logical px height).
#[tauri::command]
pub fn set_flyout_size(app: tauri::AppHandle, height: f64) {
    crate::flyout::set_size(&app, height);
}

/// Hides the quick-switch flyout (after a device is picked).
#[tauri::command]
pub fn close_flyout(app: tauri::AppHandle) {
    crate::flyout::hide(&app);
}

/// Reads whether the default microphone is currently muted.
#[tauri::command]
pub fn get_mic_muted() -> Result<bool, String> {
    audio::is_mic_muted().map_err(|e| e.to_string())
}

/// Re-registers the global shortcuts from the provided bindings. Called by the
/// frontend after the user edits a hotkey so we don't race the store's
/// async file write.
#[tauri::command]
pub fn update_hotkeys(app: tauri::AppHandle, bindings: HotkeyConfig) -> Result<(), String> {
    hotkeys::register_with(&app, &bindings).map_err(|e| e.to_string())
}
