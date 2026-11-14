//! Backdrop material (Mica / Mica Alt) of the main window.
//!
//! @see docs/janela-material.md

use tauri::window::{Effect, EffectsBuilder};
use tauri::{AppHandle, Manager};

/// First Windows 11 build; the undocumented Mica switch works from here.
const MICA_MIN_BUILD: u32 = 22000;
/// First build with `DWMWA_SYSTEMBACKDROP_TYPE`, which Mica Alt (tabbed) needs.
const MICA_ALT_MIN_BUILD: u32 = 22621;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Material {
    Mica,
    MicaAlt,
    Solid,
}

impl Material {
    /// The spelling the frontend stores and the dropdown lists.
    pub fn as_str(self) -> &'static str {
        match self {
            Material::Mica => "mica",
            Material::MicaAlt => "micaAlt",
            Material::Solid => "solid",
        }
    }
}

/// What the OS can actually draw for a requested material.
///
/// The window is `transparent`, so asking for a backdrop the OS cannot paint
/// would leave it see-through instead of merely flat: anything unsupported
/// steps down (Mica Alt to Mica, Mica to solid) and the caller learns where it
/// landed. An unknown name is solid, the one answer that is always safe.
pub fn resolve(requested: &str, build: u32) -> Material {
    match requested {
        "mica" if build >= MICA_MIN_BUILD => Material::Mica,
        "micaAlt" if build >= MICA_ALT_MIN_BUILD => Material::MicaAlt,
        "micaAlt" if build >= MICA_MIN_BUILD => Material::Mica,
        _ => Material::Solid,
    }
}

/// Applies `requested` to the main window and returns the material in effect.
///
/// Light or dark follows the window's own theme, which the frontend keeps in
/// step with the app's theme preference (`theme/windowChrome.ts`).
pub fn apply(app: &AppHandle, requested: &str) -> Result<Material, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is gone".to_string())?;
    let material = resolve(requested, windows_build());
    let effects = match material {
        Material::Mica => Some(EffectsBuilder::new().effect(Effect::Mica).build()),
        Material::MicaAlt => Some(EffectsBuilder::new().effect(Effect::Tabbed).build()),
        Material::Solid => None,
    };
    window.set_effects(effects).map_err(|e| e.to_string())?;
    Ok(material)
}

#[cfg(windows)]
fn windows_build() -> u32 {
    use std::sync::OnceLock;

    use windows::Wdk::System::SystemServices::RtlGetVersion;
    use windows::Win32::System::SystemInformation::OSVERSIONINFOW;

    static BUILD: OnceLock<u32> = OnceLock::new();
    *BUILD.get_or_init(|| {
        let mut info = OSVERSIONINFOW {
            dwOSVersionInfoSize: std::mem::size_of::<OSVERSIONINFOW>() as u32,
            ..Default::default()
        };
        // `GetVersionExW` reports 6.2 to a process without a compatibility
        // manifest; `RtlGetVersion` always tells the truth.
        // SAFETY: `info` is a valid, correctly sized OSVERSIONINFOW.
        match unsafe { RtlGetVersion(&mut info) }.ok() {
            Ok(()) => info.dwBuildNumber,
            Err(e) => {
                log::warn!("could not read the Windows build, using a solid window: {e}");
                0
            }
        }
    })
}

#[cfg(not(windows))]
fn windows_build() -> u32 {
    0
}

#[cfg(test)]
mod tests {
    use super::{resolve, Material};

    const WIN10: u32 = 19045;
    const WIN11_21H2: u32 = 22000;
    const WIN11_22H2: u32 = 22621;

    #[test]
    fn solid_is_solid_everywhere() {
        for build in [0, WIN10, WIN11_21H2, WIN11_22H2] {
            assert_eq!(resolve("solid", build), Material::Solid);
        }
    }

    #[test]
    fn windows_10_never_gets_a_transparent_window() {
        assert_eq!(resolve("mica", WIN10), Material::Solid);
        assert_eq!(resolve("micaAlt", WIN10), Material::Solid);
    }

    #[test]
    fn mica_alt_steps_down_to_mica_before_the_system_backdrop_api() {
        assert_eq!(resolve("micaAlt", WIN11_21H2), Material::Mica);
        assert_eq!(resolve("micaAlt", WIN11_22H2), Material::MicaAlt);
    }

    #[test]
    fn mica_is_available_from_the_first_windows_11_build() {
        assert_eq!(resolve("mica", WIN11_21H2 - 1), Material::Solid);
        assert_eq!(resolve("mica", WIN11_21H2), Material::Mica);
    }

    #[test]
    fn an_unknown_name_is_solid() {
        assert_eq!(resolve("acrylic", WIN11_22H2), Material::Solid);
        assert_eq!(resolve("", WIN11_22H2), Material::Solid);
    }

    #[test]
    fn names_round_trip_with_the_frontend_spelling() {
        for name in ["mica", "micaAlt", "solid"] {
            assert_eq!(resolve(name, WIN11_22H2).as_str(), name);
        }
    }
}
