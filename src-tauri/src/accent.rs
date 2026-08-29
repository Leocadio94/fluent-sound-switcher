//! The Windows accent colour.
//!
//! Windows does not just hold one accent colour: it derives a small ramp around
//! it (three darker shades, three lighter). Those are the shades the OS itself
//! uses, already tuned by Microsoft, so the frontend builds its Fluent brand
//! ramp from them rather than inventing shades from a single hex.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// The accent shades Windows exposes, darkest to lightest, as `#rrggbb`.
#[derive(Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AccentPalette {
    pub dark3: String,
    pub dark2: String,
    pub dark1: String,
    /// The accent colour proper — what the user picked in Settings.
    pub accent: String,
    pub light1: String,
    pub light2: String,
    pub light3: String,
}

#[cfg(windows)]
mod imp {
    use super::AccentPalette;
    use windows::UI::ViewManagement::{UIColorType, UISettings};

    fn hex(color: windows::UI::Color) -> String {
        format!("#{:02x}{:02x}{:02x}", color.R, color.G, color.B)
    }

    pub fn palette() -> Option<AccentPalette> {
        let settings = UISettings::new().ok()?;
        let read = |kind| settings.GetColorValue(kind).ok().map(hex);
        Some(AccentPalette {
            dark3: read(UIColorType::AccentDark3)?,
            dark2: read(UIColorType::AccentDark2)?,
            dark1: read(UIColorType::AccentDark1)?,
            accent: read(UIColorType::Accent)?,
            light1: read(UIColorType::AccentLight1)?,
            light2: read(UIColorType::AccentLight2)?,
            light3: read(UIColorType::AccentLight3)?,
        })
    }
}

#[cfg(not(windows))]
mod imp {
    use super::AccentPalette;
    pub fn palette() -> Option<AccentPalette> {
        None
    }
}

/// Reads the current accent palette, or `None` when Windows will not say.
pub fn palette() -> Option<AccentPalette> {
    imp::palette()
}

/// Watches for the user changing their accent colour, emitting `accent-changed`.
///
/// `UISettings::ColorValuesChanged` needs the `UISettings` instance kept alive
/// for the callback to keep firing, and it fires for theme changes too — so the
/// handler re-reads and only emits when the palette actually differs.
#[cfg(windows)]
pub fn watch(app: &AppHandle) {
    use std::sync::Mutex;
    use windows::Foundation::TypedEventHandler;
    use windows::UI::ViewManagement::UISettings;

    let settings = match UISettings::new() {
        Ok(settings) => settings,
        Err(e) => {
            log::warn!("could not open UISettings; accent changes will not be seen: {e}");
            return;
        }
    };

    let app = app.clone();
    let last: Mutex<Option<AccentPalette>> = Mutex::new(palette());

    let handler = TypedEventHandler::new(move |_: &Option<UISettings>, _: &Option<_>| {
        let Some(current) = palette() else {
            return Ok(());
        };
        // Fires for any colour setting, including light/dark switches.
        if let Ok(mut last) = last.lock() {
            if last.as_ref() == Some(&current) {
                return Ok(());
            }
            *last = Some(current.clone());
        }
        log::info!("accent colour changed to {}", current.accent);
        if let Err(e) = app.emit("accent-changed", current) {
            log::warn!("could not emit accent-changed: {e}");
        }
        Ok(())
    });

    if let Err(e) = settings.ColorValuesChanged(&handler) {
        log::warn!("could not subscribe to accent colour changes: {e}");
        return;
    }
    // The subscription dies with the `UISettings` instance, and it has to last
    // for the process, so it is leaked deliberately — the same approach the
    // device and volume notifications take.
    std::mem::forget(settings);
}

#[cfg(not(windows))]
pub fn watch(_app: &AppHandle) {}
