//! In-app auto-update via `tauri-plugin-updater`. Checks the GitHub Releases
//! `latest.json`, and on a newer signed version downloads, installs and
//! restarts. `silent` startup checks stay quiet unless an update is found.

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

/// Kicks off an update check on a background task. `silent` suppresses the
/// "already up to date" / error notifications (used for the startup check).
pub fn check(app: &AppHandle, silent: bool) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let updater = match app.updater() {
            Ok(u) => u,
            Err(e) => {
                if !silent {
                    notify(&app, &format!("Updater indisponível: {e}"));
                }
                return;
            }
        };

        match updater.check().await {
            Ok(Some(update)) => {
                let version = update.version.clone();
                notify(&app, &format!("Baixando atualização {version}…"));
                if let Err(e) = update.download_and_install(|_, _| {}, || {}).await {
                    notify(&app, &format!("Falha ao atualizar: {e}"));
                    return;
                }
                notify(&app, &format!("Atualizado para {version}. Reiniciando…"));
                app.restart();
            }
            Ok(None) => {
                if !silent {
                    notify(&app, "Você já está na versão mais recente.");
                }
            }
            Err(e) => {
                if !silent {
                    notify(&app, &format!("Erro ao verificar atualizações: {e}"));
                }
            }
        }
    });
}

fn notify(app: &AppHandle, body: &str) {
    let _ = app
        .notification()
        .builder()
        .title("Fluent Sound Switcher")
        .body(body)
        .show();
}
