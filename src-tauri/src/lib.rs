//! Fluent Sound Switcher — Tauri backend entry point.

mod audio;
mod commands;
mod config;
mod hotkeys;
mod tray;

/// Simple connectivity check used by the frontend to confirm the backend is up.
#[tauri::command]
fn ping() -> String {
    format!("fluent-sound-switcher {}", env!("CARGO_PKG_VERSION"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    hotkeys::handle_event(app, shortcut, event.state());
                })
                .build(),
        )
        .manage(hotkeys::HotkeyState::default())
        .setup(|app| {
            tray::build(app.handle())?;
            if let Err(e) = hotkeys::register_all(app.handle()) {
                eprintln!("[hotkeys] initial registration failed: {e}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            commands::list_audio_devices,
            commands::set_default_audio_device,
            commands::toggle_mic_mute,
            commands::get_mic_muted,
            commands::update_hotkeys,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fluent Sound Switcher");
}
