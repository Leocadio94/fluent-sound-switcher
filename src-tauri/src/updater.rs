//! In-app auto-update via `tauri-plugin-updater`. The public GitHub repository
//! serves the signed `latest.json` from the latest release, so the check is a
//! plain HTTPS GET with no token involved.
//!
//! Flow: a check only *detects* a new version and tells the user about it
//! (toast + an "update available" bar in the main window). Installing is always
//! an explicit action, because the Windows installer terminates and restarts the
//! app -- we never want that to happen under the user's hands.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

/// Payload of the `update-available` event consumed by the main window.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateAvailable {
    version: String,
    current_version: String,
}

/// Checks for a newer signed release on a background task.
///
/// `silent` (the startup check) stays quiet unless an update is found; the tray
/// "Verificar atualizações" item passes `false` so "you're up to date" and
/// errors are reported too, and brings the main window forward on a hit.
pub fn check(app: &AppHandle, silent: bool) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let updater = match app.updater() {
            Ok(u) => u,
            Err(e) => {
                log::error!("updater unavailable: {e}");
                if !silent {
                    notify(&app, &format!("Updater indisponível: {e}"));
                }
                return;
            }
        };

        // At login the network stack is often not up yet, so the silent
        // startup check retries a few times before giving up.
        let attempts = if silent { 3 } else { 1 };
        let mut result = updater.check().await;
        for attempt in 1..attempts {
            if result.is_ok() {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_secs(15 * attempt)).await;
            result = updater.check().await;
        }

        match result {
            Ok(Some(update)) => {
                log::info!(
                    "update {} available (running {})",
                    update.version,
                    update.current_version
                );
                let payload = UpdateAvailable {
                    version: update.version.clone(),
                    current_version: update.current_version.clone(),
                };
                notify(
                    &app,
                    &format!("Atualização {} disponível.", payload.version),
                );
                if let Err(e) = app.emit("update-available", payload) {
                    log::warn!("could not emit update-available: {e}");
                }
                if !silent {
                    // The user asked explicitly — put the window with the
                    // update bar in front of them.
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
            }
            Ok(None) => {
                log::info!("update check: already on the latest version");
                if !silent {
                    notify(&app, "Você já está na versão mais recente.");
                }
            }
            Err(e) => {
                log::warn!("update check failed: {e}");
                if !silent {
                    notify(&app, &format!("Erro ao verificar atualizações: {e}"));
                }
            }
        }
    });
}

/// Downloads and installs the pending update, then restarts the app. Only
/// called from an explicit user action (the update bar in the main window).
pub fn install(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let update = match app.updater() {
            Ok(updater) => match updater.check().await {
                Ok(Some(update)) => update,
                Ok(None) => {
                    notify(&app, "Você já está na versão mais recente.");
                    let _ = app.emit("update-finished", ());
                    return;
                }
                Err(e) => {
                    notify(&app, &format!("Erro ao verificar atualizações: {e}"));
                    let _ = app.emit("update-finished", ());
                    return;
                }
            },
            Err(e) => {
                notify(&app, &format!("Updater indisponível: {e}"));
                let _ = app.emit("update-finished", ());
                return;
            }
        };

        let version = update.version.clone();
        log::info!("downloading update {version}");
        notify(&app, &format!("Baixando atualização {version}…"));
        if let Err(e) = update.download_and_install(|_, _| {}, || {}).await {
            log::error!("update {version} failed to install: {e}");
            notify(&app, &format!("Falha ao atualizar: {e}"));
            let _ = app.emit("update-finished", ());
            return;
        }
        log::info!("updated to {version}; restarting");
        notify(&app, &format!("Atualizado para {version}. Reiniciando…"));
        app.restart();
    });
}

fn notify(app: &AppHandle, body: &str) {
    if let Err(e) = app
        .notification()
        .builder()
        .title("Fluent Sound Switcher")
        .body(body)
        .show()
    {
        log::warn!("updater toast failed: {e}");
    }
}
