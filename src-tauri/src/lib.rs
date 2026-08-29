//! Fluent Sound Switcher — Tauri backend entry point.

mod accent;
mod audio;
mod auxwin;
mod banner;
pub mod cli;
mod commands;
mod config;
mod device_icon;
mod flyout;
mod hotkeys;
mod i18n;
mod logging;
mod mute;
mod notify;
mod overlay;
mod tray;
mod updater;

use tauri::Manager;

/// Simple connectivity check used by the frontend to confirm the backend is up.
#[tauri::command]
fn ping() -> String {
    format!("fluent-sound-switcher {}", env!("CARGO_PKG_VERSION"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Registered first so every later plugin/setup step can log.
        .plugin(logging::plugin())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            match hotkeys::register_all(handle) {
                Ok(failures) => {
                    for failure in failures {
                        log::warn!(
                            "hotkey not registered: {} -> {} ({})",
                            failure.action,
                            failure.accelerator,
                            failure.reason
                        );
                    }
                }
                Err(e) => log::error!("initial hotkey registration failed: {e}"),
            }
            overlay::configure(handle);
            flyout::configure(handle);
            banner::configure(handle);
            // The main window is created hidden (`visible: false` in
            // tauri.conf.json) so a login auto-start never flashes a window on
            // screen. It is revealed by the `main_window_ready` command once
            // React has painted -- unless this run should stay in the tray.
            let auto_launched = std::env::args().any(|a| a == "--autostart");
            let start_hidden = auto_launched && config::start_minimized(handle);
            handle.manage(commands::StartHidden(start_hidden));

            // Closing the main window hides it to the tray instead of quitting,
            // so the tray "Abrir" can bring it back.
            if let Some(main) = handle.get_webview_window("main") {
                // The window is declared undecorated; honour the stored
                // preference for someone who asked for the system title bar.
                if config::title_bar_style(handle) == "native" {
                    if let Err(e) = main.set_decorations(true) {
                        log::warn!("could not restore the native title bar: {e}");
                    }
                }
                let hide_target = main.clone();
                main.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = hide_target.hide();
                    }
                });
            }
            // Read the real mic state and sync the tray icon + overlay.
            mute::refresh(handle);
            // Watch for device arrivals/removals: mirror external default
            // changes into the GUI and optionally auto-switch on connect.
            audio::events::start(handle);
            // Mirror volume/mute changes made outside the app (keyboard wheel,
            // Windows mixer) on the current default output.
            audio::volume_events::rearm(handle);
            // Follow the Windows accent colour while the app is open.
            accent::watch(handle);
            // Silent check for a newer signed release on startup.
            updater::check(handle, true);
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
            commands::set_device_icon,
            commands::main_window_ready,
            commands::install_update,
            commands::open_log_folder,
            commands::get_overlay_state,
            commands::get_accent_palette,
            commands::set_title_bar_style,
            commands::set_language,
            commands::get_device_volume,
            commands::set_device_volume,
            commands::toggle_device_mute,
            commands::get_device_muted,
            commands::toggle_output_mute,
            commands::get_output_muted,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fluent Sound Switcher");
}
