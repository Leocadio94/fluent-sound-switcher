//! Tauri commands — the bridge invoked from the frontend.

use crate::audio::{self, AudioDevice};
use crate::config::HotkeyConfig;
use crate::hotkeys;

/// Returns all active input/output devices with the current defaults marked.
#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
    audio::list_devices().map_err(|e| e.to_string())
}

/// Switches the system default device to `device_id` (all roles).
#[tauri::command]
pub fn set_default_audio_device(device_id: String) -> Result<(), String> {
    audio::set_default_device(&device_id).map_err(|e| e.to_string())
}

/// Toggles the default microphone mute, returning the new muted state. Updates
/// the tray icon and overlay too.
#[tauri::command]
pub fn toggle_mic_mute(app: tauri::AppHandle) -> Result<bool, String> {
    let muted = audio::toggle_mic_mute().map_err(|e| e.to_string())?;
    crate::mute::apply(&app, muted);
    Ok(muted)
}

/// Re-applies the overlay visibility/position after the user changes the mute
/// indicator settings.
#[tauri::command]
pub fn refresh_mute_indicator(app: tauri::AppHandle) -> Result<(), String> {
    crate::overlay::update(&app, crate::mute::current(&app));
    Ok(())
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
