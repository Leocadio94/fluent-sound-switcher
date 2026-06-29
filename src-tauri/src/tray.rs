//! System tray icons. The primary icon reflects the mic mute state. An optional
//! secondary icon mirrors the current default output device (using the icon
//! Windows shows for it in the Sound control panel). Left-click on either opens
//! the quick-switch flyout; right-click opens the menu.

use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

const TRAY_ID: &str = "main";
const DEVICE_TRAY_ID: &str = "device";
const MIC_ON: &[u8] = include_bytes!("../icons/mic-on.png");
const MIC_OFF: &[u8] = include_bytes!("../icons/mic-off.png");

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    // The mic (primary) tray.
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().expect("window icon").clone())
        .tooltip("Fluent Sound Switcher")
        .menu(&build_menu(app)?)
        .show_menu_on_left_click(false)
        .on_menu_event(on_menu_event)
        .on_tray_icon_event(on_tray_icon_event)
        .build(app)?;

    // The output-device (secondary) tray. Same interactions; its icon/tooltip
    // are filled in by `refresh_device_icon`. Hidden until enabled.
    TrayIconBuilder::with_id(DEVICE_TRAY_ID)
        .icon(app.default_window_icon().expect("window icon").clone())
        .tooltip("Dispositivo de saída")
        .menu(&build_menu(app)?)
        .show_menu_on_left_click(false)
        .on_menu_event(on_menu_event)
        .on_tray_icon_event(on_tray_icon_event)
        .build(app)?;

    refresh_device_icon(app);
    Ok(())
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let show = MenuItem::with_id(app, "show", "Abrir", true, None::<&str>)?;
    let sound_panel = MenuItem::with_id(
        app,
        "sound_panel",
        "Dispositivos de reprodução",
        true,
        None::<&str>,
    )?;
    let settings =
        MenuItem::with_id(app, "settings", "Configurações", true, None::<&str>)?;
    let toggle_mute = MenuItem::with_id(
        app,
        "toggle_mute",
        "Mutar/desmutar microfone",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    Menu::with_items(
        app,
        &[&show, &settings, &sound_panel, &sep, &toggle_mute, &quit],
    )
}

fn on_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id.as_ref() {
        "show" => show_main(app),
        "settings" => {
            show_main(app);
            let _ = app.emit("open-settings", ());
        }
        "sound_panel" => open_sound_panel(),
        "toggle_mute" => crate::mute::toggle(app),
        "quit" => app.exit(0),
        _ => {}
    }
}

fn on_tray_icon_event(tray: &TrayIcon, event: TrayIconEvent) {
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        crate::flyout::toggle(tray.app_handle());
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
        return;
    };
    let bytes = if muted { MIC_OFF } else { MIC_ON };
    if let Ok(image) = Image::from_bytes(bytes) {
        let _ = tray.set_icon(Some(image));
    }
    let _ = tray.set_tooltip(Some(if muted {
        "Microfone mudo"
    } else {
        "Microfone ativo"
    }));
}

/// Refreshes the device tray's visibility (from config), icon and tooltip to the
/// current default output. Called at startup and on every default-device change.
pub fn refresh_device_icon(app: &AppHandle) {
    let Some(tray) = app.tray_by_id(DEVICE_TRAY_ID) else {
        return;
    };
    let visible = crate::config::show_device_icon(app);
    let _ = tray.set_visible(visible);
    if visible {
        update_device_image(app, &tray);
    }
}

/// Shows/hides the device tray immediately (live setting toggle), refreshing its
/// icon when shown. Visibility comes from the argument to avoid racing the
/// store's async write.
pub fn set_device_visible(app: &AppHandle, visible: bool) {
    let Some(tray) = app.tray_by_id(DEVICE_TRAY_ID) else {
        return;
    };
    let _ = tray.set_visible(visible);
    if visible {
        update_device_image(app, &tray);
    }
}

fn update_device_image(app: &AppHandle, tray: &TrayIcon) {
    let device = crate::audio::default_output().ok().flatten();
    let tooltip = device
        .as_ref()
        .map(|d| d.name.clone())
        .unwrap_or_else(|| "Dispositivo de saída".to_string());
    let _ = tray.set_tooltip(Some(&tooltip));

    let image = device
        .as_ref()
        .and_then(|d| crate::device_icon::icon_rgba_for(&d.id))
        .map(|(rgba, w, h)| Image::new_owned(rgba, w, h));

    if let Some(image) = image {
        let _ = tray.set_icon(Some(image));
    } else if let Some(fallback) = app.default_window_icon() {
        // No Windows icon available — fall back to the app icon.
        let _ = tray.set_icon(Some(fallback.clone()));
    }
}
