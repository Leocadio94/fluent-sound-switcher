//! Fluent Sound Switcher — Tauri backend entry point.

mod audio;
mod banner;
pub mod cli;
mod commands;
mod config;
mod flyout;
mod hotkeys;
mod mute;
mod notify;
mod overlay;
mod tray;

use tauri::Manager;

/// Simple connectivity check used by the frontend to confirm the backend is up.
#[tauri::command]
fn ping() -> String {
    format!("fluent-sound-switcher {}", env!("CARGO_PKG_VERSION"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    hotkeys::handle_event(app, shortcut, event.state());
                })
                .build(),
        )
        .manage(hotkeys::HotkeyState::default())
        .manage(mute::MuteState::default())
        .setup(|app| {
            let handle = app.handle();
            tray::build(handle)?;
            if let Err(e) = hotkeys::register_all(handle) {
                eprintln!("[hotkeys] initial registration failed: {e}");
            }
            overlay::configure(handle);
            flyout::configure(handle);
            banner::configure(handle);
            // Closing the main window hides it to the tray instead of quitting,
            // so the tray "Abrir" can bring it back.
            if let Some(main) = handle.get_webview_window("main") {
                let hide_target = main.clone();
                main.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = hide_target.hide();
                    }
                });

                // When auto-launched at login, optionally start hidden in tray.
                let auto_launched = std::env::args().any(|a| a == "--autostart");
                if auto_launched && config::start_minimized(handle) {
                    let _ = main.hide();
                }
            }
            // Read the real mic state and sync the tray icon + overlay.
            mute::refresh(handle);
            // Watch for device arrivals/removals: mirror external default
            // changes into the GUI and optionally auto-switch on connect.
            audio::events::start(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            commands::list_audio_devices,
            commands::set_default_audio_device,
            commands::toggle_mic_mute,
            commands::get_mic_muted,
            commands::update_hotkeys,
            commands::refresh_mute_indicator,
            commands::set_flyout_size,
            commands::close_flyout,
            commands::preview_notification,
            commands::get_autostart,
            commands::set_autostart,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fluent Sound Switcher");
}
