//! Fluent Sound Switcher — Tauri backend entry point.
//!
//! Phase 0 wires up the app shell (window + store plugin). Later phases add the
//! audio core (`audio/`), tray, hotkeys and CLI.

/// Simple connectivity check used by the frontend to confirm the backend is up.
#[tauri::command]
fn ping() -> String {
    format!("fluent-sound-switcher {}", env!("CARGO_PKG_VERSION"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error while running Fluent Sound Switcher");
}
