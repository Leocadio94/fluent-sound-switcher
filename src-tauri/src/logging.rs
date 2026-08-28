//! Application logging.
//!
//! The GUI build is a `windows_subsystem = "windows"` binary, so anything
//! written to stdout/stderr goes nowhere: a user-reported bug used to be
//! undebuggable. Everything now goes through the `log` crate into a rotating
//! file in the app log dir, which the user can open from Settings.

use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_log::{Target, TargetKind};

/// Log file name (the plugin appends `.log`).
const LOG_FILE: &str = "fluent-sound-switcher";

/// Rotate at 2 MiB — enough for a long session, small enough to attach to an
/// issue report.
const MAX_FILE_SIZE: u128 = 2 * 1024 * 1024;

/// Builds the log plugin: always to a rotating file, plus stdout in dev.
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    let mut builder = tauri_plugin_log::Builder::new()
        // `Builder::new()` ships with default targets (including a LogDir one
        // named after the product), and `.target()` *adds* to them — leaving two
        // identical log files side by side. Start from an empty list.
        .clear_targets()
        .target(Target::new(TargetKind::LogDir {
            file_name: Some(LOG_FILE.to_string()),
        }))
        .max_file_size(MAX_FILE_SIZE)
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
        .level(if cfg!(debug_assertions) {
            log::LevelFilter::Debug
        } else {
            log::LevelFilter::Info
        })
        // The webview plugins are chatty at debug level and drown our own lines.
        .level_for("tao", log::LevelFilter::Warn)
        .level_for("wry", log::LevelFilter::Warn);

    if cfg!(debug_assertions) {
        builder = builder.target(Target::new(TargetKind::Stdout));
    }

    builder.build()
}

/// Opens the log directory in Explorer, so a user can attach the file to a bug
/// report without hunting through AppData.
pub fn open_log_dir<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("log dir unavailable: {e}"))?;
    // The directory only exists once the first line is flushed.
    if let Err(e) = std::fs::create_dir_all(&dir) {
        log::warn!("could not create log dir {}: {e}", dir.display());
    }
    reveal(&dir)
}

#[cfg(windows)]
fn reveal(dir: &std::path::Path) -> Result<(), String> {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let path = HSTRING::from(dir);
    let verb = HSTRING::from("open");
    // ShellExecuteW returns a fake HINSTANCE; values <= 32 mean failure.
    let result = unsafe {
        ShellExecuteW(
            None,
            PCWSTR(verb.as_ptr()),
            PCWSTR(path.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    if result.0 as usize <= 32 {
        let msg = format!(
            "ShellExecuteW failed ({}) for {}",
            result.0 as usize,
            dir.display()
        );
        log::error!("{msg}");
        return Err(msg);
    }
    Ok(())
}

#[cfg(not(windows))]
fn reveal(_dir: &std::path::Path) -> Result<(), String> {
    Err("unsupported platform".to_string())
}
