//! Tauri commands — the bridge invoked from the frontend.

use crate::audio::{self, AudioDevice};

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
