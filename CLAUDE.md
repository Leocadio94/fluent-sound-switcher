# CLAUDE.md — Fluent Sound Switcher

Guidance for working in this repo. Keep this file fed as the project grows.

## What this is

Windows 11 desktop app to switch the system audio input/output devices, with a
modern **Fluent 2** UI. Functional parity goal with
[SoundSwitch](https://github.com/belphemur/soundswitch), but a UI consistent
with Windows 11 and fixing SoundSwitch pain points (notably the on-screen
notification appearing *behind* the taskbar in fullscreen apps like Steam Big
Picture).

## Stack

- **Frontend**: React 19 + Vite 6 + TypeScript, **Fluent UI React v9**
  (`@fluentui/react-components`), icons via `@fluentui/react-icons`.
- **i18n**: `react-i18next`. Default `pt-BR`, also `en`. Strings in
  `src/i18n/locales/*.json`.
- **Backend**: Rust (Tauri v2). Windows audio via the `windows` crate 0.58
  (Core Audio COM) + `windows-core` 0.58.
- **Tauri plugins**: `store` (config), `global-shortcut`, `notification`,
  `autostart`, `updater` (signed auto-update via GitHub Releases; pubkey in
  `tauri.conf.json`, private key kept outside the repo at `~/.tauri/`), `log`.
- **Package manager**: pnpm. **Identifier**: `com.fluentsoundswitcher.app`
  (config at `%APPDATA%/com.fluentsoundswitcher.app/config.json`).

## Status

Phases 0–8 and 10–18 done (9 deferred); `0.2.0` adds per-device volume, output
mute, volume hotkeys + OSD, multi-monitor placement for the floating windows,
backend translations, logging, CI and the first tests. Remaining: a custom title
bar, accent-colour theming, code signing (Authenticode cert, removes the
SmartScreen warning) and per-app profiles (Phase 9, experimental, deferred). The
phase numbering in `CHANGELOG.md` is the source of truth.

## Commands

```bash
pnpm install        # install JS deps
pnpm tauri:dev      # run the app (Tauri dev, launches vite + rust)
pnpm tauri:build    # production bundle (msi + nsis)
pnpm lint           # tsc --noEmit (frontend typecheck)
# backend checks (what CI runs):
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

## Layout

- `src/` — React frontend.
  - `main.tsx` branches the render on `getCurrentWindow().label`
    (`overlay`/`flyout`/`banner`/`main`) and sets `data-window` on `<html>`.
  - `App.tsx` (main window), `views/` (`DeviceList`, `Overlay`, `Flyout`,
    `Banner`, `SettingsDialog` — a shell over `views/settings/*Tab.tsx`),
    `components/` (`HotkeyInput`, `DeviceRow` shared by the list and flyout).
  - `hooks/` — `useDevices`, `useFavorites`, `useHotkeys`, `useMute`,
    `useMuteIndicator`, `useNotifications`, `useAutoSwitch`, `useGeneral`,
    `useVolume` (per-device level/mute), `useVolumeOsd`, plus
    `usePersistedConfig` (load/save/apply a settings record) and
    `useTauriEvent` (subscribe for a component's lifetime).
  - `lib/tauri.ts` (invoke wrappers), `lib/config.ts` (store wrapper + types),
    `lib/configSchema.ts` (validation + schema migration),
    `theme/` (Fluent theme + OS sync), `i18n/locales/*.json`.
  - `styles.css` scopes the transparent/centered aux-window CSS via
    `:root[data-window="…"]` so it doesn't leak into the main window.
- `src-tauri/src/` — Rust.
  - `audio/` — isolated Core Audio module: `enumerator.rs` (list + default
    output), `policy.rs` (`IPolicyConfig` switch), `volume.rs` (endpoint volume
    and mute, any device / either direction), `events.rs`
    (`IMMNotificationClient`), `volume_events.rs`
    (`IAudioEndpointVolumeCallback` on the default output), `mod.rs`
    (`ensure_com`, `cycle_default`). `sessions.rs` (per-app) not built yet.
  - Windows: `overlay.rs` (mute indicator), `banner.rs` (switch banner),
    `flyout.rs` (tray quick-switch) — all transparent/topmost/click-through;
    `auxwin.rs` holds what the three share (monitor resolution, anchoring, the
    click-through extended style).
  - `i18n.rs` — the strings the backend owns (tray menu, notification titles,
    updater messages), keyed off the frontend's `language`.
  - `accent.rs` — the Windows accent colour and the six shades Windows derives
    around it (`UISettings`, WinRT), plus a watcher for the user changing it.
  - `tray.rs` (two tray icons: mic + output device), `device_icon.rs` (extract
    the Windows endpoint icon → RGBA), `mute.rs` (central mute state),
    `notify.rs` (toast/banner/sound), `hotkeys.rs` (global shortcuts),
    `cli.rs` (subcommands), `config.rs` (reads the store file), `commands.rs`,
    `logging.rs` (log plugin + "open log folder"), `lib.rs` (builder/setup),
    `main.rs` (CLI dispatch then `run`).
- `scripts/` — release helpers used by CI: `check-version.mjs` (tag vs. the
  three version manifests), `release-notes.mjs` (release body from CHANGELOG).

## Key technical notes

- Setting the default device is **not** a public API: uses the undocumented COM
  `IPolicyConfig` (CLSID `{870af99c-171d-4f9e-af0d-e63df40c2bc9}`, IID
  `f8679f50-850a-41cf-9c72-430f290290c8`), declared via `#[interface]` — sets all
  three roles. Validated in Phase 1.
- `#[interface]`/`#[implement]` macros need `windows-core` as a **direct** dep so
  generated `::windows_core` paths resolve.
- Device monitoring: `IMMNotificationClient` (`audio/events.rs`) registered for
  the process lifetime (leaked, never unregistered). `OnDefaultDeviceChanged`
  (console role) mirrors external changes to the GUI (`device-changed` event),
  refreshes the output tray icon on `eRender` and re-reads the mute state on
  `eCapture` — single chokepoint for any switch (ours/hotkey/CLI/sound-panel).
  Setting the default never loops there (the callback only mirrors). Optional
  auto-switch happens on device arrival.
- **These callbacks run on the Windows audio service's thread**: never block or
  call COM in them. Every handler captures what it needs and hands the work to
  `dispatch()` (a blocking task). `IAudioEndpointVolumeCallback`
  (`volume_events.rs`) follows the same rule.
- `volume_events::rearm` must be called whenever the default *output* changes:
  the callback is bound to one endpoint, so without it the app keeps listening
  to the device the user just moved away from. It also unregisters the previous
  one, so registrations do not pile up.
- The `overlay` window shows two faces, discriminated by `kind` in the
  `overlay-state` payload: the persistent mute indicator and the transient
  volume OSD. They share one window deliberately — four WebView2 instances are
  already alive, and this one is already transparent/topmost/click-through.
- Output tray icon (`device_icon.rs`): reads the endpoint icon-path property
  (best-effort key, `SHDefExtractIconW` → `HICON` → RGBA via GetDIBits, BGRA→RGBA),
  falls back to the app icon.
- The aux windows must be topmost + click-through (`WS_EX_NOACTIVATE |
  WS_EX_TOOLWINDOW`, `set_ignore_cursor_events`, `always_on_top`) so they render
  over fullscreen games — the SoundSwitch fix. Pattern from sibling
  `ponto-app/src-tauri/src/overlay.rs`.
- Position them through `auxwin::anchor` / `auxwin::work_area`, never from
  `primary_monitor()`: a secondary monitor can sit at negative coordinates, so
  primary-relative maths puts the window on the wrong screen. The target monitor
  follows the `overlayMonitor` setting (cursor / primary / foreground) and the
  scale factor comes from *that* monitor, not the window.
- HWND version mismatch: `window.hwnd()` returns a `windows` 0.61 HWND; rebuild as
  our 0.58 HWND with `HWND(raw.0)` (0.58 HWND is `*mut c_void`).
- The `main` window is created with `visible: false` and revealed by the
  `main_window_ready` command that the React root invokes after its first render
  — this is why an autostart at login doesn't flash a window. Whether to stay in
  the tray is decided once in `setup()` (`--autostart` + `startMinimized`) and
  kept as the managed `commands::StartHidden`.
- Updater (`updater.rs`): public repo, so the endpoint is GitHub's
  `releases/latest/download/latest.json` with no token. `check()` only detects
  and emits `update-available`; `install()` (the `install_update` command behind
  the main window's update bar) downloads/installs/restarts. Release must be
  published, not draft/prerelease, or `releases/latest` 404s.
- The backend reads config straight from the store file (`config.rs`) instead of
  IPC, caching the parsed document until the file's mtime moves. The store
  autosaves **asynchronously**, so any setting that must apply immediately is
  passed directly as a command argument (don't re-read the file) — e.g.
  `refresh_mute_indicator`, `update_hotkeys`, `set_device_icon`, `set_language`.
- Dual GUI/CLI binary: `main.rs` parses argv first; `cli::run_if_cli` filters
  `--autostart`, `AttachConsole(ATTACH_PARENT_PROCESS)` for output, returns an
  exit code when a subcommand ran. `#![windows_subsystem = "windows"]` in release.
- WebView2 auto-darkens controls in dark mode; `index.html` + the theme pin
  `color-scheme` to the resolved theme to stop it.
- A `useTauriEvent` handler is registered once, so anything it reads from the
  component closure is frozen at first render. Read changing state through a
  ref (see `useVolume`) or pass it in the deps array.
- The overlay and banner re-emit their payload a few times to cover a frozen
  webview; those retries must check the generation counter, or a burst of
  changes replays every stale state on the way to the last one.
- Never call `save*()` from inside a `setState` updater: updaters must be pure,
  and React 19 runs them twice under StrictMode, which wrote the config (and
  fired the backend command) twice. Use `usePersistedConfig`, or derive the next
  value from a ref.
- `t()` keys are type-checked against `locales/pt-BR.json`
  (`i18n/react-i18next.d.ts`, augmenting **`i18next`** — not `react-i18next`,
  which type-checks fine while doing nothing), and `i18n/localeParity.ts` fails
  the build if en.json drifts from pt-BR's shape.
- Fluent's `MessageBar` sizes its box for two lines even with
  `layout="multiline"`, drawing a third outside the border. Use
  `views/settings/SettingsNotice.tsx` for anything longer.
- Config values are validated on read (`lib/configSchema.ts`) against option
  lists exported from `lib/config.ts`; add a new option to that list, not to a
  second copy in the dropdown.
- The `main` window is declared `decorations: false` and the app draws its own
  caption (`components/TitleBar.tsx`); `titleBarStyle` in the config switches
  back to the system one live via `set_decorations`.
- Window controls called from the webview (`minimize`, `toggleMaximize`,
  `close`, and `data-tauri-drag-region`) need explicit permissions —
  `core:default` does not include them. They live in
  `capabilities/main-window.json`, scoped to `main` alone.
- WebView2 turns a drag region into a real window above the page
  (`DRAG_BAR_WINDOW_CLASS`), so anything clickable inside the caption must
  declare `WebkitAppRegion: "no-drag"` or the clicks never reach the DOM.
- **Do not try to bring back the Windows 11 snap-layouts flyout.** It needs the
  top-level window to answer `WM_NCHITTEST` with `HTMAXBUTTON`, and WRY's child
  windows cover the whole client area and consume the pointer first — measured:
  18 hit tests reached a subclassed window proc from the borders, zero from over
  the maximize button. That is why the "system" title bar option exists.
- The Fluent brand ramp is built from the *seven* shades Windows exposes
  (`theme/accentTheme.ts`), not from the accent hex alone: those are the shades
  the desktop already uses. The accent proper is pinned to stop 80
  (`colorBrandBackground`), so buttons and the active row are exactly the colour
  the user picked. An unreadable shade falls back to the default palette.
- `list_devices` returns unplugged and disabled endpoints as well as active
  ones (`state` field), so a sleeping headset keeps its place in the list and
  the cycle order. Anything that acts on a device — switching, cycling, volume —
  must check `is_available()` first; the UI shows an unavailable device only
  when it is a favourite.
- Device volume is fetched per device on demand (`useVolume`), never folded into
  `list_audio_devices`: that would activate an `IAudioEndpointVolume` interface
  per endpoint on every refresh, and the list refetches on each
  `device-changed`. Slider writes are debounced (~40 ms).
- **Logging**: the GUI build is `windows_subsystem = "windows"`, so nothing
  printed reaches a console — always use `log::` (never `println!`/`eprintln!`)
  and read the rotating file via Settings → General → "Abrir pasta de logs".
  Keep `let _ =` only where a failure is genuinely benign.
- Hotkey registration can fail (another app owns the combo). `register_with`
  returns the failures instead of swallowing them; `update_hotkeys` forwards
  them so the settings UI can warn. Never report a binding as applied without
  checking.

## For other agents

`AGENTS.md` is a thin pointer to this file, for agents that look for that name.
Keep it in sync if the commands or ground rules change.

## Working style

- Phased iterations. One phase per iteration, commit at the end of each.
- Update `CHANGELOG.md` per phase and keep this file current.
- App icons live in `src-tauri/icons/`, generated from `icons/logo.svg` via
  `pnpm tauri icon icons/logo.svg` (regenerate after editing the SVG). The tray
  mic-state icons (`mic-on.png`/`mic-off.png`) are separate and hand-made.
