//! System power and session events.
//!
//! Windows never tells a plain Tauri app that the machine resumed from sleep or
//! that the user unlocked the session, so nothing re-asserts the aux windows.
//! The cost is visible: WebView2 suspends its renderer while the machine sleeps
//! and only resumes it on an invisible→visible transition, but the overlay is
//! *already* shown when the machine sleeps — so the transition never happens
//! and it comes back on screen painting nothing. The OS can also reset the
//! extended styles and move the windows onto a monitor that no longer exists.
//!
//! This subclasses the main window (top-level, alive for the whole process, so
//! it receives the broadcast resume message) and asks to be told about unlocks.
//! It also re-anchors the windows on `WM_DISPLAYCHANGE`, since waking often
//! restores a different resolution or monitor layout than the windows were
//! placed on.

#[cfg(windows)]
mod imp {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::OnceLock;
    use std::time::Duration;

    use tauri::AppHandle;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::RemoteDesktop::{
        WTSRegisterSessionNotification, NOTIFY_FOR_THIS_SESSION,
    };
    use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{
        PBT_APMRESUMEAUTOMATIC, PBT_APMRESUMESUSPEND, WM_DISPLAYCHANGE, WM_POWERBROADCAST,
        WM_WTSSESSION_CHANGE, WTS_SESSION_UNLOCK,
    };

    /// The app's main window is top-level and never destroyed (closing it hides
    /// it), so it is the natural place to receive the power broadcast.
    const TARGET_LABEL: &str = "main";
    const SUBCLASS_ID: usize = 0xF501;

    /// Delays before each resume-recovery pass, in ms. The first wakes the
    /// WebView2 renderer as soon as possible; the second runs once the display
    /// layout has stabilised, so a window lands on the right monitor.
    const RESUME_DELAYS_MS: [u64; 2] = [400, 2000];

    /// Delay before the display-change recovery pass, in ms. Shorter than the
    /// resume passes because a mode change is signalled *after* it has applied.
    const REANCHOR_DELAYS_MS: [u64; 1] = [150];

    pub fn watch(app: &AppHandle) {
        use tauri::Manager;

        let Some(window) = app.get_webview_window(TARGET_LABEL) else {
            log::warn!("no main window; resume/unlock recovery is disabled");
            return;
        };
        let Ok(raw) = window.hwnd() else {
            log::warn!("no HWND for the main window; resume/unlock recovery is disabled");
            return;
        };
        // `hwnd()` returns a `windows` 0.61 HWND; rebuild it as our 0.58 one.
        let hwnd = HWND(raw.0);

        // The subclass proc needs the handle for the process lifetime, so the
        // Box is leaked deliberately — the same approach the audio callbacks
        // take for their registration.
        let data = Box::into_raw(Box::new(app.clone())) as usize;

        unsafe {
            if !SetWindowSubclass(hwnd, Some(subclass_proc), SUBCLASS_ID, data).as_bool() {
                log::warn!("could not subclass the main window for power events");
                drop(Box::from_raw(data as *mut AppHandle));
                return;
            }
            // `WM_WTSSESSION_CHANGE` is not a broadcast, so it has to be asked
            // for; resume messages are delivered without this. Both registrations
            // last for the process — the main window is never destroyed, so there
            // is nothing to tear down on exit.
            if let Err(e) = WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION) {
                log::warn!("could not register for session unlock notifications: {e}");
            }
        }
    }

    unsafe extern "system" fn subclass_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        data: usize,
    ) -> LRESULT {
        // SAFETY: `watch` leaked a live `Box<AppHandle>` into `data`.
        let app = &*(data as *const AppHandle);
        if is_resume_message(msg, wparam.0) {
            schedule(app, true);
        } else if msg == WM_DISPLAYCHANGE {
            // Resolution or monitor topology changed — the aux windows may now
            // sit on the wrong screen. Re-anchor them, but do not force the
            // WebView2 transition: the renderer is not suspended here.
            schedule(app, false);
        }
        DefSubclassProc(hwnd, msg, wparam, lparam)
    }

    /// Whether a window message means "the machine just came back".
    fn is_resume_message(msg: u32, wparam: usize) -> bool {
        let event = wparam as u32;
        match msg {
            WM_POWERBROADCAST => event == PBT_APMRESUMEAUTOMATIC || event == PBT_APMRESUMESUSPEND,
            WM_WTSSESSION_CHANGE => event == WTS_SESSION_UNLOCK,
            _ => false,
        }
    }

    /// Per-trigger newest-recovery id, so a burst of the same kind collapses.
    /// Resume and display-change use *separate* counters: a mode change that
    /// lands during a resume must not cancel the resume's pending repaint pass.
    fn generation(is_resume: bool) -> &'static AtomicU64 {
        static RESUME: OnceLock<AtomicU64> = OnceLock::new();
        static DISPLAY: OnceLock<AtomicU64> = OnceLock::new();
        if is_resume {
            RESUME.get_or_init(|| AtomicU64::new(0))
        } else {
            DISPLAY.get_or_init(|| AtomicU64::new(0))
        }
    }

    /// Queues the recovery runs without blocking the window proc. Touching the
    /// windows from inside it would run re-entrantly in the message dispatch;
    /// `run_on_main_thread` hands the work to the event loop instead.
    ///
    /// On a user-triggered wake Windows sends both `PBT_APMRESUMEAUTOMATIC` and
    /// `PBT_APMRESUMESUSPEND`, and an unlock adds a third; the generation check
    /// keeps that burst to one run.
    fn schedule(app: &AppHandle, is_resume: bool) {
        let generation = generation(is_resume);
        let generation_id = generation.fetch_add(1, Ordering::SeqCst) + 1;
        log::info!("system event detected; scheduling overlay recovery");
        let delays: &[u64] = if is_resume {
            &RESUME_DELAYS_MS
        } else {
            &REANCHOR_DELAYS_MS
        };
        for (index, delay) in delays.iter().copied().enumerate() {
            let app = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(delay));
                if generation.load(Ordering::SeqCst) != generation_id {
                    return;
                }
                // Only the first resume pass forces the WebView2 transition; the
                // later ones re-anchor once the display has settled, so the
                // overlay does not blink twice. Display changes never repaint.
                let force_repaint = is_resume && index == 0;
                let dispatcher = app.clone();
                if let Err(e) = app.run_on_main_thread(move || recover(&dispatcher, force_repaint))
                {
                    log::warn!("could not schedule overlay recovery: {e}");
                }
            });
        }
    }

    fn recover(app: &AppHandle, force_repaint: bool) {
        // The default output or its mute state can change while the machine
        // sleeps, so read them before restoring the windows.
        crate::mute::refresh(app);
        if force_repaint {
            crate::overlay::recover(app);
        }
        crate::banner::recover(app);
        crate::flyout::recover(app);
        // A headset that re-enumerated on resume is a new default endpoint, and
        // the volume callback is bound to one endpoint.
        crate::audio::volume_events::rearm(app);
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use windows::Win32::UI::WindowsAndMessaging::{PBT_APMSUSPEND, WTS_SESSION_LOCK};

        #[test]
        fn detects_resume_but_not_suspend() {
            assert!(is_resume_message(
                WM_POWERBROADCAST,
                PBT_APMRESUMEAUTOMATIC as usize
            ));
            assert!(is_resume_message(
                WM_POWERBROADCAST,
                PBT_APMRESUMESUSPEND as usize
            ));
            assert!(!is_resume_message(
                WM_POWERBROADCAST,
                PBT_APMSUSPEND as usize
            ));
        }

        #[test]
        fn detects_unlock_but_not_lock() {
            assert!(is_resume_message(
                WM_WTSSESSION_CHANGE,
                WTS_SESSION_UNLOCK as usize
            ));
            assert!(!is_resume_message(
                WM_WTSSESSION_CHANGE,
                WTS_SESSION_LOCK as usize
            ));
        }

        #[test]
        fn ignores_unrelated_messages() {
            assert!(!is_resume_message(0xFFFF, 0));
            // A display change is recovered, but as a re-anchor, not a resume —
            // so it must not be mistaken for one.
            assert!(!is_resume_message(WM_DISPLAYCHANGE, 0));
        }
    }
}

#[cfg(windows)]
pub use imp::watch;

#[cfg(not(windows))]
pub fn watch(_app: &tauri::AppHandle) {}
