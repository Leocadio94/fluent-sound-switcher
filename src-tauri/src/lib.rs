//! Fluent Sound Switcher — Tauri backend entry point.
//!
//! Phase 1 adds the audio core (`audio/`), the commands that expose it to the
//! frontend, and a minimal system tray.

mod audio;
mod commands;
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
        .setup(|app| {
            tray::build(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            commands::list_audio_devices,
            commands::set_default_audio_device,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fluent Sound Switcher");
}
