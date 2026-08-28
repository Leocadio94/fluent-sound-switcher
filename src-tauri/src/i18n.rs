//! Translations for the strings the backend owns.
//!
//! The tray menu, the device-change toasts and every updater message were
//! hardcoded in pt-BR, so an English user got a half-translated app: the window
//! spoke English and the tray did not. The language mirrors the frontend's
//! `language` config key.

use std::sync::{OnceLock, RwLock};

use tauri::AppHandle;

pub const DEFAULT_LANGUAGE: &str = "pt-BR";

/// Language chosen this session, ahead of the config file. The frontend store
/// autosaves asynchronously, so a language switch passes the value directly
/// instead of racing the file write.
static OVERRIDE: OnceLock<RwLock<Option<String>>> = OnceLock::new();

fn override_cell() -> &'static RwLock<Option<String>> {
    OVERRIDE.get_or_init(|| RwLock::new(None))
}

/// Sets the language used by the backend-owned strings from here on.
pub fn set_language(language: &str) {
    match override_cell().write() {
        Ok(mut guard) => *guard = Some(language.to_string()),
        Err(e) => log::error!("could not store the language override: {e}"),
    }
}

/// The active language: the session override when set, else the config file.
fn current(app: &AppHandle) -> String {
    if let Ok(guard) = override_cell().read() {
        if let Some(language) = guard.as_ref() {
            return language.clone();
        }
    }
    crate::config::language(app)
}

/// Every backend-owned string. An enum rather than string keys so a typo is a
/// compile error and the set stays enumerable.
#[derive(Clone, Copy)]
pub enum Msg {
    TrayOpen,
    TraySettings,
    TrayPlaybackDevices,
    TrayToggleMute,
    TrayCheckUpdates,
    TrayQuit,
    TrayMicMuted,
    TrayMicLive,
    OutputDevice,
    InputDevice,
    UpToDate,
    /// Takes the version. See [`fmt1`].
    UpdateAvailable,
    /// Takes the version.
    Downloading,
    /// Takes the version.
    UpdatedRestarting,
    /// Takes the error.
    UpdaterUnavailable,
    /// Takes the error.
    UpdateCheckFailed,
    /// Takes the error.
    UpdateFailed,
}

/// Resolves a message in the user's configured language.
pub fn t(app: &AppHandle, msg: Msg) -> &'static str {
    translate(&current(app), msg)
}

/// Resolves a message whose text contains a single `{}` placeholder and fills
/// it in — enough for every parameterized string the backend has.
pub fn fmt1(app: &AppHandle, msg: Msg, arg: &str) -> String {
    t(app, msg).replacen("{}", arg, 1)
}

fn translate(language: &str, msg: Msg) -> &'static str {
    // Anything that is not English falls back to pt-BR, the project default.
    if language.starts_with("en") {
        en(msg)
    } else {
        pt_br(msg)
    }
}

fn pt_br(msg: Msg) -> &'static str {
    match msg {
        Msg::TrayOpen => "Abrir",
        Msg::TraySettings => "Configurações",
        Msg::TrayPlaybackDevices => "Dispositivos de reprodução",
        Msg::TrayToggleMute => "Mutar/desmutar microfone",
        Msg::TrayCheckUpdates => "Verificar atualizações",
        Msg::TrayQuit => "Sair",
        Msg::TrayMicMuted => "Microfone mudo",
        Msg::TrayMicLive => "Microfone ativo",
        Msg::OutputDevice => "Dispositivo de saída",
        Msg::InputDevice => "Dispositivo de entrada",
        Msg::UpToDate => "Você já está na versão mais recente.",
        Msg::UpdateAvailable => "Atualização {} disponível.",
        Msg::Downloading => "Baixando atualização {}…",
        Msg::UpdatedRestarting => "Atualizado para {}. Reiniciando…",
        Msg::UpdaterUnavailable => "Updater indisponível: {}",
        Msg::UpdateCheckFailed => "Erro ao verificar atualizações: {}",
        Msg::UpdateFailed => "Falha ao atualizar: {}",
    }
}

fn en(msg: Msg) -> &'static str {
    match msg {
        Msg::TrayOpen => "Open",
        Msg::TraySettings => "Settings",
        Msg::TrayPlaybackDevices => "Playback devices",
        Msg::TrayToggleMute => "Toggle microphone mute",
        Msg::TrayCheckUpdates => "Check for updates",
        Msg::TrayQuit => "Quit",
        Msg::TrayMicMuted => "Microphone muted",
        Msg::TrayMicLive => "Microphone live",
        Msg::OutputDevice => "Output device",
        Msg::InputDevice => "Input device",
        Msg::UpToDate => "You are already on the latest version.",
        Msg::UpdateAvailable => "Update {} available.",
        Msg::Downloading => "Downloading update {}…",
        Msg::UpdatedRestarting => "Updated to {}. Restarting…",
        Msg::UpdaterUnavailable => "Updater unavailable: {}",
        Msg::UpdateCheckFailed => "Could not check for updates: {}",
        Msg::UpdateFailed => "Update failed: {}",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn falls_back_to_portuguese_for_unknown_languages() {
        assert_eq!(translate("pt-BR", Msg::TrayQuit), "Sair");
        assert_eq!(translate("fr", Msg::TrayQuit), "Sair");
        assert_eq!(translate("", Msg::TrayQuit), "Sair");
    }

    #[test]
    fn matches_any_english_variant() {
        assert_eq!(translate("en", Msg::TrayQuit), "Quit");
        assert_eq!(translate("en-US", Msg::TrayQuit), "Quit");
        assert_eq!(translate("en-GB", Msg::TrayQuit), "Quit");
    }

    #[test]
    fn placeholder_is_filled_once() {
        assert_eq!(
            en(Msg::UpdateAvailable).replacen("{}", "0.2.0", 1),
            "Update 0.2.0 available."
        );
    }
}
