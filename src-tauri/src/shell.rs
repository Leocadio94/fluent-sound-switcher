//! Keeps the mute overlay immune to the shell's "Show desktop".
//!
//! The taskbar button at the far right (and Win+D) *minimizes* every window in
//! the session — topmost band included — and never messages the app about it.
//! The always-on-top mute indicator therefore just disappears, and only comes
//! back when the user toggles the mute state again, which defeats the point of
//! a persistent indicator.
//!
//! This hooks the system's `EVENT_SYSTEM_MINIMIZEEND` for our own process and,
//! when the window that finished minimizing is the overlay, un-minimizes it and
//! re-asserts the topmost band. It is *out-of-context*, so the callback runs on
//! the thread that installed the hook — the main thread, which owns every
//! window — which means `ShowWindow`/`SetWindowPos` on our own HWND is safe and
//! must not be routed through the async `unminimize()` (that blocks on a channel
//! the message loop would only drain once this callback returns).
//!
//! Only the overlay is guarded: the banner and flyout are transient and meant to
//! go away, and the main window is a normal window the user may legitimately
//! minimize.

#[cfg(windows)]
mod imp {
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::OnceLock;

    use tauri::AppHandle;
    use windows::Win32::Foundation::{HMODULE, HWND};
    use windows::Win32::System::Threading::GetCurrentProcessId;
    use windows::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
    use windows::Win32::UI::WindowsAndMessaging::{
        IsIconic, ShowWindow, EVENT_SYSTEM_MINIMIZEEND, EVENT_SYSTEM_MINIMIZESTART, OBJID_WINDOW,
        SW_RESTORE, WINEVENT_OUTOFCONTEXT,
    };

    /// The overlay's raw HWND address, captured once at `watch()` time. `0` until
    /// the window is found. `HWND` is a `*mut c_void` newtype, so it fits.
    fn overlay_hwnd() -> &'static AtomicUsize {
        static H: OnceLock<AtomicUsize> = OnceLock::new();
        H.get_or_init(|| AtomicUsize::new(0))
    }

    /// Installs the hook. Call from the main thread (Tauri's `setup`), so the
    /// out-of-context callback is dispatched on the loop that owns the windows.
    pub fn watch(app: &AppHandle) {
        use tauri::Manager;

        let Some(window) = app.get_webview_window(crate::overlay::OVERLAY_LABEL) else {
            log::warn!("no overlay window; the show-desktop guard is disabled");
            return;
        };
        let Ok(raw) = window.hwnd() else {
            log::warn!("no overlay HWND; the show-desktop guard is disabled");
            return;
        };
        // `hwnd()` hands back a `windows` 0.61 HWND; store the address, which is
        // version-independent, for the callback to compare against.
        overlay_hwnd().store(raw.0 as usize, Ordering::Relaxed);

        let hook = unsafe {
            SetWinEventHook(
                EVENT_SYSTEM_MINIMIZESTART,
                EVENT_SYSTEM_MINIMIZEEND,
                HMODULE::default(),
                Some(win_event_proc),
                GetCurrentProcessId(),
                0,
                WINEVENT_OUTOFCONTEXT,
            )
        };
        if hook.0.is_null() {
            log::warn!("could not install the show-desktop guard for the overlay");
            return;
        }
        // The hook is registered with the OS; `HWINEVENTHOOK` is a plain handle
        // with no RAII semantics, so dropping our copy does not unhook it. It
        // lives for the process — the same "leak for process lifetime" approach
        // the power subclass and the audio callbacks use.
        let _ = hook;
        log::info!("show-desktop guard installed for the mute overlay");
    }

    unsafe extern "system" fn win_event_proc(
        _hook: HWINEVENTHOOK,
        event: u32,
        hwnd: HWND,
        id_object: i32,
        _id_child: i32,
        _event_thread: u32,
        _event_time: u32,
    ) {
        // Only react once a minimize has finished, and only to whole windows (not
        // their client/caret sub-objects).
        if event != EVENT_SYSTEM_MINIMIZEEND || id_object != OBJID_WINDOW.0 {
            return;
        }

        let addr = overlay_hwnd().load(Ordering::Relaxed);
        // Compare against the overlay itself: "Show desktop" minimizes every
        // window, but only the mute indicator must bounce straight back.
        if addr == 0 || hwnd.0 as usize != addr {
            return;
        }

        let overlay = HWND(addr as *mut core::ffi::c_void);
        if IsIconic(overlay).as_bool() {
            // A minimized window keeps its painted surface; restoring it is all
            // the WebView2 needs (no invisible->visible transition required here).
            let _ = ShowWindow(overlay, SW_RESTORE);
        }
        crate::auxwin::reassert_topmost_hwnd(overlay);
    }
}

#[cfg(windows)]
pub use imp::watch;

#[cfg(not(windows))]
pub fn watch(_app: &tauri::AppHandle) {}
