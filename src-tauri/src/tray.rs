//! System tray icons. The primary icon reflects the mic mute state. An optional
//! secondary icon mirrors the current default output device (using the icon
//! Windows shows for it in the Sound control panel). Right-click on either
//! opens the Fluent menu drawn by the flyout window (`flyout::show_menu`); the
//! left-click action is configurable per icon (see `TrayClickAction`).

use crate::i18n::{self, Msg};
use serde::Serialize;
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

const TRAY_ID: &str = "main";
const DEVICE_TRAY_ID: &str = "device";
const MIC_ON: &[u8] = include_bytes!("../icons/mic-on.png");
const MIC_OFF: &[u8] = include_bytes!("../icons/mic-off.png");

/// What a left-click on a tray icon does. Storage vocabulary of the
/// `trayLeftClick` config key (`"mic"` / `"device"` sub-keys); the strings the
/// frontend writes are validated by `config::tray_click_action`.
pub const TRAY_CLICK_FLYOUT: &str = "flyout";
pub const TRAY_CLICK_TOGGLE_MIC_MUTE: &str = "toggleMicMute";
pub const TRAY_CLICK_TOGGLE_OUTPUT_MUTE: &str = "toggleOutputMute";
pub const TRAY_CLICK_CYCLE_OUTPUT: &str = "cycleOutput";
pub const TRAY_CLICK_OPEN_APP: &str = "openApp";
pub const TRAY_CLICK_SOUND_PANEL: &str = "soundPanel";

/// The left-click action configured for a tray icon, parsed from the store.
#[derive(Clone, Copy, PartialEq)]
pub enum TrayClickAction {
    /// The quick-switch flyout (the original behaviour).
    Flyout,
    ToggleMicMute,
    ToggleOutputMute,
    /// Cycle to the next favorite output device.
    CycleOutput,
    /// Reveal the main window.
    OpenApp,
    /// Open Windows' Sound settings page.
    SoundPanel,
}

fn parse_click_action(value: &str) -> TrayClickAction {
    match value {
        TRAY_CLICK_TOGGLE_MIC_MUTE => TrayClickAction::ToggleMicMute,
        TRAY_CLICK_TOGGLE_OUTPUT_MUTE => TrayClickAction::ToggleOutputMute,
        TRAY_CLICK_CYCLE_OUTPUT => TrayClickAction::CycleOutput,
        TRAY_CLICK_OPEN_APP => TrayClickAction::OpenApp,
        TRAY_CLICK_SOUND_PANEL => TrayClickAction::SoundPanel,
        // Anything unrecognised, including the documented "flyout", falls back
        // to the original behaviour so a hand-edited file cannot mute the mic
        // unexpectedly.
        _ => TrayClickAction::Flyout,
    }
}

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    // Bundled by `tauri.conf.json`; if it is somehow missing there is no icon
    // to put in the tray at all, so fail loudly instead of aborting the process
    // from an `expect` under `panic = "abort"`.
    let base_icon = app.default_window_icon().cloned().ok_or_else(|| {
        log::error!("no default window icon bundled; the tray cannot be built");
        tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "default window icon missing",
        ))
    })?;

    // The mic (primary) tray.
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(base_icon.clone())
        .tooltip("Fluent Sound Switcher")
        .on_tray_icon_event(on_tray_icon_event)
        .build(app)?;

    // The output-device (secondary) tray. Same interactions; its icon/tooltip
    // are filled in by `refresh_device_icon`. Hidden until enabled.
    TrayIconBuilder::with_id(DEVICE_TRAY_ID)
        .icon(base_icon)
        .tooltip(i18n::t(app, Msg::OutputDevice))
        .on_tray_icon_event(on_tray_icon_event)
        .build(app)?;

    refresh_device_icon(app);
    Ok(())
}

/// Re-reads the translated tooltips, e.g. after the UI language changed. The
/// menu needs no refresh: its labels are fetched each time it opens.
pub fn refresh_texts(app: &AppHandle) {
    set_mute_icon(app, crate::mute::current(app));
    refresh_device_icon(app);
}

/// One row of the right-click menu, as the flyout window draws it. The labels
/// come from here so the backend stays the single owner of the tray strings.
#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MenuEntry {
    Item { id: &'static str, label: String },
    Separator,
}

pub fn menu_entries(app: &AppHandle) -> Vec<MenuEntry> {
    let item = |id, msg| MenuEntry::Item {
        id,
        label: i18n::t(app, msg).to_string(),
    };
    vec![
        item("show", Msg::TrayOpen),
        item("settings", Msg::TraySettings),
        item("sound_panel", Msg::TrayPlaybackDevices),
        MenuEntry::Separator,
        item("toggle_mute", Msg::TrayToggleMute),
        MenuEntry::Separator,
        item("check_updates", Msg::TrayCheckUpdates),
        item("quit", Msg::TrayQuit),
    ]
}

/// Runs the menu entry the flyout reported. Spawned off the caller's thread
/// like the left-click actions: the mute path talks to COM.
pub fn run_menu_action(app: &AppHandle, id: &str) {
    let app = app.clone();
    let id = id.to_owned();
    tauri::async_runtime::spawn(async move {
        match id.as_str() {
            "show" => show_main(&app),
            "settings" => {
                show_main(&app);
                let _ = app.emit("open-settings", ());
            }
            "sound_panel" => open_sound_panel(),
            "toggle_mute" => crate::mute::toggle(&app),
            "check_updates" => crate::updater::check(&app, false),
            "quit" => app.exit(0),
            other => log::warn!("unknown tray menu entry '{other}'"),
        }
    });
}

/// Runs a left-click action. Spawned off the event-handler thread like
/// `hotkeys::perform`: the mute and cycle paths talk to COM, and the flyout
/// path gives focus to a window — none of it should sit on the event loop.
fn run_click_action(app: &AppHandle, action: TrayClickAction) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        match action {
            TrayClickAction::Flyout => crate::flyout::toggle(&app),
            TrayClickAction::ToggleMicMute => crate::mute::toggle(&app),
            TrayClickAction::ToggleOutputMute => crate::mute::toggle_output(&app),
            TrayClickAction::CycleOutput => {
                // Mirrors `hotkeys::cycle` for the output direction: emit for the
                // frontend/flyout and notify, unlike the raw `audio::cycle_default`.
                let favorites = crate::config::favorites(&app, "output");
                match crate::audio::cycle_default("output", &favorites) {
                    Ok(Some(device)) => {
                        if let Err(e) = app.emit("device-changed", &device) {
                            log::warn!("could not emit device-changed: {e}");
                        }
                        crate::notify::device_changed(&app, &device.name, device.direction);
                    }
                    Ok(None) => log::debug!("tray cycle output: no candidate device"),
                    Err(e) => log::error!("tray cycle output failed: {e}"),
                }
            }
            TrayClickAction::OpenApp => show_main(&app),
            TrayClickAction::SoundPanel => open_sound_panel(),
        }
    });
}

fn on_tray_icon_event(tray: &TrayIcon, event: TrayIconEvent) {
    let app = tray.app_handle();
    match &event {
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } => {
            // `TrayIconEvent::id()` names the icon that was clicked ("main" or
            // "device"); each reads its own configured action.
            let action = if event.id() == TRAY_ID {
                crate::config::tray_click_action(app, "mic")
            } else {
                crate::config::tray_click_action(app, "device")
            };
            run_click_action(app, parse_click_action(&action));
        }
        TrayIconEvent::Click {
            button: MouseButton::Right,
            button_state: MouseButtonState::Up,
            position,
            ..
        } => {
            // Gives focus to a window, so keep it off the event-loop thread.
            let app = app.clone();
            let cursor = (position.x, position.y);
            tauri::async_runtime::spawn(async move {
                crate::flyout::show_menu(&app, cursor);
            });
        }
        _ => {}
    }
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn open_sound_panel() {
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer")
            .arg("ms-settings:sound")
            .spawn();
    }
}

/// Swaps the primary tray icon and tooltip to reflect the mic mute state.
pub fn set_mute_icon(app: &AppHandle, muted: bool) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        log::warn!("mic tray icon missing; cannot reflect mute state");
        return;
    };
    let bytes = if muted { MIC_OFF } else { MIC_ON };
    match Image::from_bytes(bytes) {
        Ok(image) => {
            if let Err(e) = tray.set_icon(Some(image)) {
                log::warn!("could not set the mic tray icon: {e}");
            }
        }
        Err(e) => log::error!("bundled mic icon failed to decode: {e}"),
    }
    if let Err(e) = tray.set_tooltip(Some(i18n::t(
        app,
        if muted {
            Msg::TrayMicMuted
        } else {
            Msg::TrayMicLive
        },
    ))) {
        log::warn!("could not set the mic tray tooltip: {e}");
    }
}

/// Refreshes the device tray's visibility (from config), icon and tooltip to the
/// current default output. Called at startup and on every default-device change.
pub fn refresh_device_icon(app: &AppHandle) {
    let Some(tray) = app.tray_by_id(DEVICE_TRAY_ID) else {
        log::warn!("device tray icon missing; cannot refresh it");
        return;
    };
    let visible = crate::config::show_device_icon(app);
    if let Err(e) = tray.set_visible(visible) {
        log::warn!("could not set device tray visibility: {e}");
    }
    if visible {
        update_device_image(app, &tray);
    }
}

/// Shows/hides the device tray immediately (live setting toggle), refreshing its
/// icon when shown. Visibility comes from the argument to avoid racing the
/// store's async write.
pub fn set_device_visible(app: &AppHandle, visible: bool) {
    let Some(tray) = app.tray_by_id(DEVICE_TRAY_ID) else {
        log::warn!("device tray icon missing; cannot change its visibility");
        return;
    };
    if let Err(e) = tray.set_visible(visible) {
        log::warn!("could not set device tray visibility: {e}");
    }
    if visible {
        update_device_image(app, &tray);
    }
}

fn update_device_image(app: &AppHandle, tray: &TrayIcon) {
    let device = match crate::audio::default_output() {
        Ok(device) => device,
        Err(e) => {
            log::warn!("could not read the default output for the tray: {e}");
            None
        }
    };
    let tooltip = device
        .as_ref()
        .map(|d| d.name.clone())
        .unwrap_or_else(|| i18n::t(app, Msg::OutputDevice).to_string());
    if let Err(e) = tray.set_tooltip(Some(&tooltip)) {
        log::warn!("could not set the device tray tooltip: {e}");
    }

    let image = device
        .as_ref()
        .and_then(|d| crate::device_icon::icon_rgba_for(&d.id))
        .map(|(rgba, w, h)| Image::new_owned(rgba, w, h));

    let result = match image {
        Some(image) => tray.set_icon(Some(image)),
        // No Windows icon available — fall back to the app icon.
        None => match app.default_window_icon() {
            Some(fallback) => tray.set_icon(Some(fallback.clone())),
            None => Ok(()),
        },
    };
    if let Err(e) = result {
        log::warn!("could not set the device tray icon: {e}");
    }
}
