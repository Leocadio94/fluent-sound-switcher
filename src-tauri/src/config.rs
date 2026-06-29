//! Read-only access to the frontend's `store` plugin file (`config.json` in
//! the app data dir). The backend needs the favorites (for hotkey cycling) and
//! the hotkey bindings (to register global shortcuts) without round-tripping
//! through the webview.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

pub const STORE_FILE: &str = "config.json";

pub const DEFAULT_CYCLE_OUTPUT: &str = "Ctrl+Alt+F11";
pub const DEFAULT_CYCLE_INPUT: &str = "Ctrl+Alt+F12";
pub const DEFAULT_TOGGLE_MUTE: &str = "Ctrl+Alt+M";

/// The user's global-shortcut bindings. Field names mirror the JSON keys the
/// frontend store writes.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyConfig {
    pub cycle_output: String,
    pub cycle_input: String,
    pub toggle_mute: String,
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            cycle_output: DEFAULT_CYCLE_OUTPUT.to_string(),
            cycle_input: DEFAULT_CYCLE_INPUT.to_string(),
            toggle_mute: DEFAULT_TOGGLE_MUTE.to_string(),
        }
    }
}

/// On-screen mute indicator (overlay) preferences.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MuteIndicator {
    /// "always" | "mutedOnly" | "unmutedOnly" | "hidden".
    pub mode: String,
    /// "topCenter" | "bottomCenter" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight".
    pub position: String,
    /// "full" (icon + text) | "icon" (icon only).
    #[serde(default = "default_style")]
    pub style: String,
}

fn default_style() -> String {
    "full".to_string()
}

impl Default for MuteIndicator {
    fn default() -> Self {
        Self {
            mode: "mutedOnly".to_string(),
            position: "bottomCenter".to_string(),
            style: default_style(),
        }
    }
}

/// Device-change notification preferences.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NotificationConfig {
    /// Native Windows toast.
    pub native: bool,
    /// On-screen banner (fullscreen-safe).
    pub banner: bool,
    /// Play a short sound.
    pub sound: bool,
    /// Banner position, same vocabulary as the mute overlay.
    pub banner_position: String,
}

impl Default for NotificationConfig {
    fn default() -> Self {
        Self {
            native: false,
            banner: true,
            sound: false,
            banner_position: "topCenter".to_string(),
        }
    }
}

fn store_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join(STORE_FILE))
}

fn read(app: &AppHandle) -> Value {
    store_path(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Value::Null)
}

/// Favorite device ids for a direction ("output"/"input"), empty when unset.
pub fn favorites(app: &AppHandle, direction: &str) -> Vec<String> {
    read(app)
        .get("favorites")
        .and_then(|f| f.get(direction))
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

/// Hotkey bindings, falling back to defaults for any missing key.
pub fn hotkeys(app: &AppHandle) -> HotkeyConfig {
    let value = read(app);
    let h = value.get("hotkeys");
    let pick = |key: &str, default: &str| {
        h.and_then(|h| h.get(key))
            .and_then(|v| v.as_str())
            .unwrap_or(default)
            .to_string()
    };
    HotkeyConfig {
        cycle_output: pick("cycleOutput", DEFAULT_CYCLE_OUTPUT),
        cycle_input: pick("cycleInput", DEFAULT_CYCLE_INPUT),
        toggle_mute: pick("toggleMute", DEFAULT_TOGGLE_MUTE),
    }
}

/// Mute indicator preferences, falling back to defaults when unset.
pub fn mute_indicator(app: &AppHandle) -> MuteIndicator {
    read(app)
        .get("muteIndicator")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default()
}

/// Notification preferences, falling back to defaults when unset.
pub fn notifications(app: &AppHandle) -> NotificationConfig {
    read(app)
        .get("notifications")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default()
}

/// Auto-switch-on-connect preferences. When a device connects (e.g. a TV or
/// monitor with audio is plugged in) it can grab the default output.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AutoSwitchConfig {
    /// Master toggle.
    pub enabled: bool,
    /// "favoritesOnly" (only output favorites may grab default) | "any".
    pub mode: String,
}

impl Default for AutoSwitchConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            mode: "favoritesOnly".to_string(),
        }
    }
}

/// Auto-switch preferences, falling back to defaults when unset.
pub fn auto_switch(app: &AppHandle) -> AutoSwitchConfig {
    read(app)
        .get("autoSwitch")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default()
}

/// Whether the app should start hidden to the tray when auto-launched.
pub fn start_minimized(app: &AppHandle) -> bool {
    read(app)
        .get("startMinimized")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

/// Whether to show the second tray icon reflecting the current output device.
pub fn show_device_icon(app: &AppHandle) -> bool {
    read(app)
        .get("showDeviceIcon")
        .and_then(|v| v.as_bool())
        .unwrap_or(true)
}
