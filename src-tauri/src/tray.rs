//! System tray icon. The icon reflects the mic mute state. Left-click opens the
//! quick-switch flyout; right-click opens the menu.

use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

const TRAY_ID: &str = "main";
const MIC_ON: &[u8] = include_bytes!("../icons/mic-on.png");
const MIC_OFF: &[u8] = include_bytes!("../icons/mic-off.png");

pub fn build(app: &AppHandle) -> tauri::Result<()> {
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
    let menu = Menu::with_items(
        app,
        &[&show, &settings, &sound_panel, &sep, &toggle_mute, &quit],
    )?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().expect("window icon").clone())
        .tooltip("Fluent Sound Switcher")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "settings" => {
                show_main(app);
                let _ = app.emit("open-settings", ());
            }
            "sound_panel" => open_sound_panel(),
            "toggle_mute" => crate::mute::toggle(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::flyout::toggle(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
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

/// Swaps the tray icon and tooltip to reflect the mic mute state.
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
