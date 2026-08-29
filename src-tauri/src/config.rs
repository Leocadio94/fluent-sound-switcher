//! Read-only access to the frontend's `store` plugin file (`config.json` in
//! the app data dir). The backend needs the favorites (for hotkey cycling) and
//! the hotkey bindings (to register global shortcuts) without round-tripping
//! through the webview.

use std::path::{Path, PathBuf};
use std::sync::{OnceLock, RwLock};
use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

pub const STORE_FILE: &str = "config.json";

/// Bundle identifier, mirroring `tauri.conf.json`. The CLI runs without an
/// `AppHandle` and has to derive the app-data dir from `%APPDATA%` itself.
pub const IDENTIFIER: &str = "com.fluentsoundswitcher.app";

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
    /// Volume bindings default to empty: binding the media keys globally would
    /// hijack them from Windows, so they are strictly opt-in.
    #[serde(default)]
    pub volume_up: String,
    #[serde(default)]
    pub volume_down: String,
    #[serde(default)]
    pub toggle_output_mute: String,
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            cycle_output: DEFAULT_CYCLE_OUTPUT.to_string(),
            cycle_input: DEFAULT_CYCLE_INPUT.to_string(),
            toggle_mute: DEFAULT_TOGGLE_MUTE.to_string(),
            volume_up: String::new(),
            volume_down: String::new(),
            toggle_output_mute: String::new(),
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

/// Path of the frontend store file inside a given app-data directory.
pub fn store_path_in(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(STORE_FILE)
}

/// Path of the frontend store file, resolved through Tauri.
pub fn store_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| store_path_in(&d))
}

/// Parsed config, kept until the file's mtime moves.
///
/// Every getter used to re-read and re-parse the whole file: a single device
/// switch cost three full reads (notification prefs, favorites, auto-switch),
/// some of them from a COM callback on the Windows audio thread.
static CACHE: OnceLock<RwLock<Option<(SystemTime, Value)>>> = OnceLock::new();

fn cache() -> &'static RwLock<Option<(SystemTime, Value)>> {
    CACHE.get_or_init(|| RwLock::new(None))
}

/// mtime of the store file, or `None` when it is missing/unreadable.
fn modified(path: &PathBuf) -> Option<SystemTime> {
    std::fs::metadata(path).ok()?.modified().ok()
}

fn read(app: &AppHandle) -> Value {
    let Some(path) = store_path(app) else {
        log::warn!("app data dir unavailable; falling back to default config");
        return Value::Null;
    };

    let stamp = modified(&path);
    if let Some(stamp) = stamp {
        if let Ok(guard) = cache().read() {
            if let Some((cached_stamp, value)) = guard.as_ref() {
                if *cached_stamp == stamp {
                    return value.clone();
                }
            }
        }
    }

    let raw = match std::fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(e) => {
            // Absent on first run, before the frontend writes it: expected.
            if e.kind() != std::io::ErrorKind::NotFound {
                log::warn!("could not read {}: {e}", path.display());
            }
            return Value::Null;
        }
    };
    match serde_json::from_str::<Value>(&raw) {
        Ok(value) => {
            if let (Some(stamp), Ok(mut guard)) = (stamp, cache().write()) {
                *guard = Some((stamp, value.clone()));
            }
            value
        }
        Err(e) => {
            // Silently reverting every setting to its default is the worst
            // possible failure mode to debug, so say so loudly.
            log::error!(
                "{} is not valid JSON ({e}); every setting falls back to its default",
                path.display()
            );
            Value::Null
        }
    }
}

/// Favorite device ids for a direction ("output"/"input") in an already-parsed
/// store document. Shared with the CLI, which reads the file on its own.
pub fn favorites_from(value: &Value, direction: &str) -> Vec<String> {
    value
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

/// Favorite device ids for a direction ("output"/"input"), empty when unset.
pub fn favorites(app: &AppHandle, direction: &str) -> Vec<String> {
    favorites_from(&read(app), direction)
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
        volume_up: pick("volumeUp", ""),
        volume_down: pick("volumeDown", ""),
        toggle_output_mute: pick("toggleOutputMute", ""),
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

/// Volume on-screen-display preferences. Shares the overlay window with the
/// mute indicator; see `overlay::show_volume`.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VolumeOsd {
    pub enabled: bool,
    /// Same vocabulary as the mute overlay and the banner.
    pub position: String,
}

impl Default for VolumeOsd {
    fn default() -> Self {
        Self {
            enabled: true,
            position: "bottomCenter".to_string(),
        }
    }
}

/// Volume OSD preferences, falling back to defaults when unset.
pub fn volume_osd(app: &AppHandle) -> VolumeOsd {
    read(app)
        .get("volumeOsd")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default()
}

/// Which monitor the aux windows target: "cursor" (default), "primary" or
/// "foreground". See `auxwin::work_area`.
pub fn overlay_monitor(app: &AppHandle) -> String {
    read(app)
        .get("overlayMonitor")
        .and_then(|v| v.as_str())
        .unwrap_or(crate::auxwin::MONITOR_CURSOR)
        .to_string()
}

/// "custom" (the app draws its own title bar) or "native" (Windows draws it).
///
/// Custom is the default; the app-drawn bar matches the rest of the UI, at the
/// cost of the Windows 11 snap-layouts flyout, which needs the top-level window
/// to answer a hit test the webview never lets through.
pub fn title_bar_style(app: &AppHandle) -> String {
    read(app)
        .get("titleBarStyle")
        .and_then(|v| v.as_str())
        .unwrap_or("custom")
        .to_string()
}

/// UI language for the backend-owned strings (tray menu, notifications).
/// Mirrors the frontend's `language` key.
pub fn language(app: &AppHandle) -> String {
    read(app)
        .get("language")
        .and_then(|v| v.as_str())
        .unwrap_or(crate::i18n::DEFAULT_LANGUAGE)
        .to_string()
}
