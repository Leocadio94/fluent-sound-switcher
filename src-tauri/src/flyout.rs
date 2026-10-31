//! The tray flyout: a small, focusable, always-on-top window anchored above the
//! taskbar so it stays usable in fullscreen apps, dismissed on blur.
//!
//! It shows two faces in the one window, like the overlay does: the quick-switch
//! device list (left-click, bottom-right corner) and the right-click menu, drawn
//! as a Fluent menu next to the cursor instead of the native Win32 one. A fifth
//! WebView2 for the menu was not worth it.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::auxwin;
use crate::tray::MenuEntry;

pub const FLYOUT_LABEL: &str = "flyout";

const WIDTH: f64 = 300.0;
const MENU_WIDTH: f64 = 260.0;
const MARGIN: f64 = 12.0;
const DEFAULT_HEIGHT: f64 = 220.0;
const MIN_HEIGHT: f64 = 64.0;

/// Row and separator heights of the menu, only to size the window before the
/// webview reports the real height, so it does not jump when it appears.
const MENU_ROW: f64 = 32.0;
const MENU_SEPARATOR: f64 = 9.0;
const MENU_CHROME: f64 = 24.0;

/// Where the window sits.
#[derive(Clone, Copy)]
enum Anchor {
    /// Bottom-right corner of the work area (the device list).
    Corner,
    /// Beside the point that was clicked, physical pixels (the menu).
    Cursor(f64, f64),
}

static ANCHOR: Mutex<Anchor> = Mutex::new(Anchor::Corner);

/// Height the device list had last time, so reopening it does not flash at the
/// height of the menu that used the window in between.
static CORNER_HEIGHT: Mutex<f64> = Mutex::new(DEFAULT_HEIGHT);

/// What the frontend should draw. Sent on every open: the webview is suspended
/// while hidden and cannot tell which face it was left showing.
#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum View<'a> {
    Devices,
    Menu { items: &'a [MenuEntry] },
}

fn anchor() -> Anchor {
    ANCHOR.lock().map_or(Anchor::Corner, |a| *a)
}

fn set_anchor(value: Anchor) {
    if let Ok(mut a) = ANCHOR.lock() {
        *a = value;
    }
}

fn width_for(anchor: Anchor) -> f64 {
    match anchor {
        Anchor::Corner => WIDTH,
        Anchor::Cursor(..) => MENU_WIDTH,
    }
}

/// One-time setup: keep it above everything, out of the taskbar/alt-tab, and
/// dismiss it when it loses focus.
pub fn configure(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(FLYOUT_LABEL) {
        auxwin::reassert_topmost(&window);
        let _ = window.set_skip_taskbar(true);
        auxwin::apply_overlay_exstyle(&window);

        let dismiss = window.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::Focused(false) = event {
                let _ = dismiss.hide();
            }
        });
    }
}

/// Toggles the device list. When shown it is repositioned above the taskbar and
/// given focus so the blur handler can later dismiss it.
pub fn toggle(app: &AppHandle) {
    let Some(window) = app.get_webview_window(FLYOUT_LABEL) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        set_anchor(Anchor::Corner);
        let height = CORNER_HEIGHT.lock().map_or(DEFAULT_HEIGHT, |h| *h);
        // Sent on both sides of the show: before, so the right face is already
        // drawn when the window appears; after, because a webview that was
        // suspended may only take it once it is visible.
        let _ = window.emit("flyout-view", &View::Devices);
        present(app, &window, height);
        let _ = window.emit("flyout-view", &View::Devices);
        // The webview is suspended while hidden and may have missed live
        // events, so re-push the current device + mute state on open.
        let _ = window.emit("device-changed", ());
        let _ = window.emit("mic-mute-changed", crate::mute::current(app));
        // Favorites are only ever edited in the main window, which the
        // suspended flyout cannot see; re-push them too.
        let _ = window.emit("favorites-changed", ());
    }
}

/// Opens the right-click menu beside `cursor` (physical pixels, as the tray
/// click event reports it). Always shows: a click on the icon while it is open
/// has already dismissed it through the blur handler.
pub fn show_menu(app: &AppHandle, cursor: (f64, f64)) {
    let Some(window) = app.get_webview_window(FLYOUT_LABEL) else {
        return;
    };
    let items = crate::tray::menu_entries(app);
    set_anchor(Anchor::Cursor(cursor.0, cursor.1));
    // Both sides of the show, as in `toggle`.
    let _ = window.emit("flyout-view", &View::Menu { items: &items });
    present(app, &window, estimated_menu_height(&items));
    let _ = window.emit("flyout-view", &View::Menu { items: &items });
}

/// Sizes, positions and reveals the window, then takes focus.
fn present(app: &AppHandle, window: &WebviewWindow, height: f64) {
    place(app, window, height);
    let _ = window.show();
    let _ = window.set_focus();
    // Re-assert the band on every open: a session unlock can have dropped the
    // window out of it while it sat hidden, and a focused-but-not-topmost
    // window would sit below a fullscreen borderless game.
    auxwin::reassert_topmost(window);
}

/// Hides the flyout (used after a device or a menu entry is picked).
pub fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(FLYOUT_LABEL) {
        let _ = window.hide();
    }
}

/// Re-asserts the flyout's window styles after the system wakes from sleep or a
/// session unlock.
///
/// It is deliberately not hidden: the user may have opened it right after the
/// resume, and a recovery pass must not dismiss it. Only the styles `configure`
/// sets once are re-applied.
pub fn recover(app: &AppHandle) {
    let Some(window) = app.get_webview_window(FLYOUT_LABEL) else {
        return;
    };
    auxwin::apply_overlay_exstyle(&window);
    auxwin::reassert_topmost(&window);
    let _ = window.set_skip_taskbar(true);
}

/// Resizes the flyout to its content height (logical px) and repositions it.
///
/// `for_menu` says which face is reporting. The other face can still be mounted
/// for a moment after the window switched, and its stale height must not resize
/// the window it no longer owns.
pub fn set_size(app: &AppHandle, height: f64, for_menu: bool) {
    let Some(window) = app.get_webview_window(FLYOUT_LABEL) else {
        return;
    };
    if for_menu != matches!(anchor(), Anchor::Cursor(..)) {
        return;
    }
    if matches!(anchor(), Anchor::Corner) {
        if let Ok(mut remembered) = CORNER_HEIGHT.lock() {
            *remembered = height;
        }
    }
    place(app, &window, height);
}

fn estimated_menu_height(items: &[MenuEntry]) -> f64 {
    let separators = items
        .iter()
        .filter(|e| matches!(e, MenuEntry::Separator))
        .count() as f64;
    (items.len() as f64 - separators) * MENU_ROW + separators * MENU_SEPARATOR + MENU_CHROME
}

/// Sizes and positions the window on the monitor it is about to land on.
///
/// Both use that monitor's scale: the window's own is the one of wherever it
/// last was, which is the wrong DPI the first time it opens on another screen.
fn place(app: &AppHandle, window: &WebviewWindow, height_logical: f64) {
    let anchor = anchor();
    let area = match anchor {
        Anchor::Corner => auxwin::work_area(app, &crate::config::overlay_monitor(app)),
        // The menu belongs to the screen that holds the clicked tray icon,
        // whatever the user prefers for the floating windows, and that is the
        // click point: the cursor may have moved on by the time this runs.
        Anchor::Cursor(cx, cy) => auxwin::work_area_at(app, cx, cy),
    };
    let Some(area) = area else {
        log::warn!("no monitor resolved; leaving the flyout where it is");
        return;
    };
    let scale = area.scale;
    let bounds = (area.left, area.top, area.right, area.bottom);
    let size = (
        width_for(anchor) * scale,
        height_logical.max(MIN_HEIGHT) * scale,
    );
    let _ = window.set_size(PhysicalSize::new(size.0 as u32, size.1 as u32));
    let (x, y) = match anchor {
        Anchor::Corner => {
            let margin = MARGIN * scale;
            (
                (bounds.2 - size.0 - margin).max(bounds.0),
                (bounds.3 - size.1 - margin).max(bounds.1),
            )
        }
        Anchor::Cursor(cx, cy) => menu_origin((cx, cy), size, bounds),
    };
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

/// Top-left corner for a menu of `size` opened at `cursor`, inside `bounds`
/// (`left, top, right, bottom`), all physical pixels.
///
/// It opens upwards from the click, stopping at the work area's edge so it lands
/// on top of the taskbar rather than behind it; with the taskbar on top there is
/// no room above, so it opens downwards instead. Near the right edge it opens
/// leftwards, which is where a tray icon usually is.
fn menu_origin(cursor: (f64, f64), size: (f64, f64), bounds: (f64, f64, f64, f64)) -> (f64, f64) {
    let (cx, cy) = cursor;
    let (w, h) = size;
    let (left, top, right, bottom) = bounds;
    let x = if cx + w > right { cx - w } else { cx };
    let above = cy.min(bottom) - h;
    let y = if above < top { cy.max(top) } else { above };
    (
        x.clamp(left, (right - w).max(left)),
        y.clamp(top, (bottom - h).max(top)),
    )
}

#[cfg(test)]
mod tests {
    use super::menu_origin;

    const AREA: (f64, f64, f64, f64) = (0.0, 0.0, 1920.0, 1040.0);
    const SIZE: (f64, f64) = (260.0, 230.0);

    #[test]
    fn opens_up_and_left_from_a_tray_icon_at_the_bottom_right() {
        // The click lands in the taskbar, below the work area.
        let (x, y) = menu_origin((1900.0, 1060.0), SIZE, AREA);
        assert_eq!((x, y), (1640.0, 810.0));
    }

    #[test]
    fn opens_to_the_right_when_there_is_room() {
        let (x, _) = menu_origin((400.0, 1060.0), SIZE, AREA);
        assert_eq!(x, 400.0);
    }

    #[test]
    fn opens_downwards_with_the_taskbar_on_top() {
        let area = (0.0, 40.0, 1920.0, 1080.0);
        let (_, y) = menu_origin((1900.0, 10.0), SIZE, area);
        assert_eq!(y, 40.0);
    }

    #[test]
    fn stays_inside_a_monitor_at_negative_coordinates() {
        let area = (-1920.0, 0.0, 0.0, 1040.0);
        let (x, y) = menu_origin((-10.0, 1060.0), SIZE, area);
        assert!(x >= area.0 && x + SIZE.0 <= area.2);
        assert!(y >= area.1 && y + SIZE.1 <= area.3);
    }

    #[test]
    fn a_menu_taller_than_the_screen_pins_to_the_top() {
        let (_, y) = menu_origin((100.0, 500.0), (260.0, 2000.0), AREA);
        assert_eq!(y, 0.0);
    }
}
