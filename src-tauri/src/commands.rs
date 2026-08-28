//! Tauri commands — the bridge invoked from the frontend.

use tauri::Manager;

use crate::audio::{self, AudioDevice};
use crate::config::{HotkeyConfig, MuteIndicator};
use crate::hotkeys::{self, HotkeyFailure};

/// Whether this run should keep the main window hidden in the tray (set at
/// startup: auto-launched at login with "start minimized" enabled).
pub struct StartHidden(pub bool);

/// Called by the main window's React root once it has rendered. The window is
/// created invisible so an auto-start at login never flashes on screen; this
/// reveals it at the first painted frame, unless we should stay in the tray.
#[tauri::command]
pub fn main_window_ready(app: tauri::AppHandle, hidden: tauri::State<'_, StartHidden>) {
    if hidden.0 {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Downloads and installs a pending update, then restarts the app. Triggered by
/// the "update available" bar in the main window.
#[tauri::command]
pub fn install_update(app: tauri::AppHandle) {
    crate::updater::install(&app);
}

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
        match audio::list_devices() {
            Ok(devices) => match devices.iter().find(|d| d.id == device_id) {
                Some(device) => crate::notify::device_changed(&app, &device.name, device.direction),
                None => log::warn!("switched to {device_id} but it is not enumerable"),
            },
            Err(e) => log::warn!("could not enumerate devices to notify: {e}"),
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
pub fn refresh_mute_indicator(
    app: tauri::AppHandle,
    indicator: MuteIndicator,
) -> Result<(), String> {
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

/// Shows/hides the output-device tray icon live (passed directly to avoid racing
/// the store's async write).
#[tauri::command]
pub fn set_device_icon(app: tauri::AppHandle, enabled: bool) {
    crate::tray::set_device_visible(&app, enabled);
}

/// Reads a device's volume as a 0.0-1.0 scalar. `device_id` omitted means the
/// current default endpoint of `direction`.
#[tauri::command]
pub fn get_device_volume(device_id: Option<String>, direction: String) -> Result<f32, String> {
    audio::get_volume(device_id.as_deref(), &direction).map_err(|e| e.to_string())
}

/// Sets a device's volume from a 0.0-1.0 scalar.
#[tauri::command]
pub fn set_device_volume(
    device_id: Option<String>,
    direction: String,
    level: f32,
) -> Result<(), String> {
    audio::set_volume(device_id.as_deref(), &direction, level).map_err(|e| e.to_string())
}

/// Toggles a device's mute, returning the new state.
#[tauri::command]
pub fn toggle_device_mute(
    app: tauri::AppHandle,
    device_id: Option<String>,
    direction: String,
) -> Result<bool, String> {
    let muted = audio::toggle_mute(device_id.as_deref(), &direction).map_err(|e| e.to_string())?;
    // Keep the central state in step when the target was a default endpoint.
    if device_id.is_none() {
        if direction == "input" {
            crate::mute::apply(&app, muted);
        } else {
            crate::mute::apply_output(&app, muted);
        }
    }
    Ok(muted)
}

/// Reads a device's mute state.
#[tauri::command]
pub fn get_device_muted(device_id: Option<String>, direction: String) -> Result<bool, String> {
    audio::is_muted(device_id.as_deref(), &direction).map_err(|e| e.to_string())
}

/// Toggles the default output's mute, returning the new state.
#[tauri::command]
pub fn toggle_output_mute(app: tauri::AppHandle) -> Result<bool, String> {
    let muted = audio::toggle_mute(None, "output").map_err(|e| e.to_string())?;
    crate::mute::apply_output(&app, muted);
    Ok(muted)
}

/// Reads whether the default output is currently muted.
#[tauri::command]
pub fn get_output_muted() -> Result<bool, String> {
    audio::is_muted(None, "output").map_err(|e| e.to_string())
}

/// Reads whether the default microphone is currently muted.
#[tauri::command]
pub fn get_mic_muted() -> Result<bool, String> {
    audio::is_mic_muted().map_err(|e| e.to_string())
}

/// Re-registers the global shortcuts from the provided bindings. Called by the
/// frontend after the user edits a hotkey so we don't race the store's
/// async file write.
///
/// Returns the bindings that could *not* be registered (usually because another
/// app already owns the combination) so the settings UI can warn about them
/// instead of showing a dead shortcut as if it worked.
#[tauri::command]
pub fn update_hotkeys(
    app: tauri::AppHandle,
    bindings: HotkeyConfig,
) -> Result<Vec<HotkeyFailure>, String> {
    let failures = hotkeys::register_with(&app, &bindings).map_err(|e| e.to_string())?;
    for failure in &failures {
        log::warn!(
            "hotkey not registered: {} -> {} ({})",
            failure.action,
            failure.accelerator,
            failure.reason
        );
    }
    Ok(failures)
}

/// The state the mute overlay should currently be showing. Called by the
/// overlay window when it mounts, so it never has to rely on having caught the
/// events pushed at it while its renderer was frozen.
#[tauri::command]
pub fn get_overlay_state(app: tauri::AppHandle) -> crate::overlay::OverlayState {
    crate::overlay::current_state(&app)
}

/// Opens the folder holding the rotating log file, so a user can attach it to a
/// bug report. Nothing in the GUI build reaches stdout, so this is the only way
/// to see what the backend did.
#[tauri::command]
pub fn open_log_folder(app: tauri::AppHandle) -> Result<(), String> {
    crate::logging::open_log_dir(&app)
}

/// Switches the language of the backend-owned strings (tray menu, notification
/// titles, updater messages) and rebuilds the tray so the change is visible at
/// once. The value is passed directly rather than re-read, to avoid racing the
/// store's async write.
#[tauri::command]
pub fn set_language(app: tauri::AppHandle, language: String) -> Result<(), String> {
    crate::i18n::set_language(&language);
    crate::tray::rebuild_menus(&app).map_err(|e| e.to_string())
}
