//! Shared helpers for the transparent, always-on-top auxiliary windows
//! (`overlay`, `banner`, `flyout`).
//!
//! They used to duplicate both the extended-window-style call and the
//! positioning math, and the positioning only ever looked at the primary
//! monitor — with a hardcoded 1920x1080 fallback. On a multi-monitor setup the
//! mute indicator and the switch banner landed on the wrong screen, which for
//! this app is the whole point: they exist to be visible over the fullscreen
//! game the user is actually looking at.

use tauri::{AppHandle, LogicalPosition, Monitor, WebviewWindow};

/// Which monitor the aux windows should appear on (config `overlayMonitor`).
pub const MONITOR_CURSOR: &str = "cursor";
pub const MONITOR_PRIMARY: &str = "primary";
pub const MONITOR_FOREGROUND: &str = "foreground";

/// A monitor's work area (taskbar excluded) in physical pixels, plus the scale
/// factor needed to talk to Tauri's logical positioning.
pub struct WorkArea {
    pub left: f64,
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
    pub scale: f64,
}

impl WorkArea {
    /// The same rect in logical pixels: `(left, top, right, bottom)`.
    pub fn logical(&self) -> (f64, f64, f64, f64) {
        (
            self.left / self.scale,
            self.top / self.scale,
            self.right / self.scale,
            self.bottom / self.scale,
        )
    }
}

/// Resolves the work area of the monitor to place an aux window on, following
/// the user's preference. Falls back to the primary monitor, and returns `None`
/// only when Windows reports no monitor at all — in which case the caller
/// leaves the window where it is rather than guessing coordinates.
pub fn work_area(app: &AppHandle, preference: &str) -> Option<WorkArea> {
    let monitor = resolve_monitor(app, preference).or_else(|| {
        log::debug!("monitor preference '{preference}' unresolved; using the primary monitor");
        app.primary_monitor().ok().flatten()
    })?;

    let area = monitor.work_area();
    Some(WorkArea {
        left: area.position.x as f64,
        top: area.position.y as f64,
        right: area.position.x as f64 + area.size.width as f64,
        bottom: area.position.y as f64 + area.size.height as f64,
        scale: monitor.scale_factor(),
    })
}

fn resolve_monitor(app: &AppHandle, preference: &str) -> Option<Monitor> {
    match preference {
        MONITOR_PRIMARY => app.primary_monitor().ok().flatten(),
        MONITOR_FOREGROUND => {
            let (x, y) = foreground_center()?;
            app.monitor_from_point(x, y).ok().flatten()
        }
        // `cursor` is the default: the mouse is the cheapest proxy for the
        // screen the user is currently looking at.
        _ => {
            let position = app.cursor_position().ok()?;
            app.monitor_from_point(position.x, position.y)
                .ok()
                .flatten()
        }
    }
}

/// Centre of the foreground window, in physical screen coordinates.
#[cfg(windows)]
fn foreground_center() -> Option<(f64, f64)> {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect).ok()?;
        Some((
            (rect.left as f64 + rect.right as f64) / 2.0,
            (rect.top as f64 + rect.bottom as f64) / 2.0,
        ))
    }
}

#[cfg(not(windows))]
fn foreground_center() -> Option<(f64, f64)> {
    None
}

/// Places a fixed-size aux window at one of the six named anchors of the target
/// monitor's work area. `pos` uses the config vocabulary shared by the mute
/// overlay and the banner (`topCenter`, `bottomRight`, …).
pub fn anchor(
    app: &AppHandle,
    window: &WebviewWindow,
    pos: &str,
    width: f64,
    height: f64,
    margin: f64,
) {
    let preference = crate::config::overlay_monitor(app);
    let Some(area) = work_area(app, &preference) else {
        log::warn!("no monitor resolved; leaving the aux window where it is");
        return;
    };
    let (x, y) = anchor_point(area.logical(), pos, width, height, margin);

    if let Err(e) = window.set_position(LogicalPosition::new(x, y)) {
        log::warn!("could not position the aux window: {e}");
    }
}

/// The anchor maths, split out so it can be tested without a window.
///
/// `area` is `(left, top, right, bottom)` in logical pixels. Note that a
/// secondary monitor can sit at negative coordinates (it is common for one to
/// be placed above the primary), which is exactly what the old primary-only
/// code got wrong: it assumed the origin was 0,0.
fn anchor_point(
    area: (f64, f64, f64, f64),
    pos: &str,
    width: f64,
    height: f64,
    margin: f64,
) -> (f64, f64) {
    let (left, top, right, bottom) = area;

    let x = if pos.contains("Left") {
        left + margin
    } else if pos.contains("Right") {
        right - width - margin
    } else {
        left + (right - left - width) / 2.0
    };
    // The work area already excludes the taskbar, so a plain margin is enough
    // at the bottom — the old code padded by 3x the margin to clear it.
    let y = if pos.starts_with("top") {
        top + margin * 2.0
    } else {
        bottom - height - margin
    };

    (x, y)
}

/// Makes a window never take focus and stay out of the taskbar/alt-tab list.
/// Combined with `always_on_top` + `set_ignore_cursor_events`, this is what
/// lets the overlay render over fullscreen games.
#[cfg(windows)]
pub fn apply_overlay_exstyle(window: &WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };
    let Ok(raw) = window.hwnd() else {
        log::warn!("no HWND for the aux window; cannot apply the overlay style");
        return;
    };
    // `hwnd()` hands back a `windows` 0.61 HWND; rebuild it as our 0.58 one.
    let hwnd = HWND(raw.0);
    unsafe {
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let ex = ex | (WS_EX_NOACTIVATE.0 as isize) | (WS_EX_TOOLWINDOW.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex);
    }
}

#[cfg(not(windows))]
pub fn apply_overlay_exstyle(_window: &WebviewWindow) {}

#[cfg(test)]
mod tests {
    use super::anchor_point;

    /// The primary monitor of a real dual-screen setup: 2560x1440 with a 66px
    /// taskbar.
    const PRIMARY: (f64, f64, f64, f64) = (0.0, 0.0, 2560.0, 1374.0);

    /// The secondary monitor of that same setup: 1920x1080 sitting *above* the
    /// primary and offset horizontally, so both coordinates are unlike the
    /// primary's and the top is negative.
    const SECONDARY: (f64, f64, f64, f64) = (313.0, -1080.0, 2233.0, 0.0);

    const WIDTH: f64 = 240.0;
    const HEIGHT: f64 = 72.0;
    const MARGIN: f64 = 24.0;

    #[test]
    fn centers_horizontally_on_the_primary_monitor() {
        let (x, _) = anchor_point(PRIMARY, "bottomCenter", WIDTH, HEIGHT, MARGIN);
        assert_eq!(x, (2560.0 - 240.0) / 2.0);
    }

    #[test]
    fn keeps_clear_of_the_taskbar_at_the_bottom() {
        let (_, y) = anchor_point(PRIMARY, "bottomCenter", WIDTH, HEIGHT, MARGIN);
        // Inside the work area, which already excludes the taskbar.
        assert_eq!(y, 1374.0 - 72.0 - 24.0);
        assert!(y + HEIGHT <= PRIMARY.3);
    }

    #[test]
    fn follows_a_secondary_monitor_at_negative_coordinates() {
        // Every anchor has to land inside the secondary monitor's bounds; the
        // old code produced primary-relative coordinates here.
        for pos in [
            "topLeft",
            "topCenter",
            "topRight",
            "bottomLeft",
            "bottomCenter",
            "bottomRight",
        ] {
            let (x, y) = anchor_point(SECONDARY, pos, WIDTH, HEIGHT, MARGIN);
            assert!(
                x >= SECONDARY.0 && x + WIDTH <= SECONDARY.2,
                "{pos}: x={x} outside [{}, {}]",
                SECONDARY.0,
                SECONDARY.2
            );
            assert!(
                y >= SECONDARY.1 && y + HEIGHT <= SECONDARY.3,
                "{pos}: y={y} outside [{}, {}]",
                SECONDARY.1,
                SECONDARY.3
            );
        }
    }

    #[test]
    fn left_and_right_anchors_hug_their_edges() {
        let (left_x, _) = anchor_point(SECONDARY, "topLeft", WIDTH, HEIGHT, MARGIN);
        let (right_x, _) = anchor_point(SECONDARY, "topRight", WIDTH, HEIGHT, MARGIN);
        assert_eq!(left_x, 313.0 + MARGIN);
        assert_eq!(right_x, 2233.0 - WIDTH - MARGIN);
    }
}
