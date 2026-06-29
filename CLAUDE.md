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
  `autostart`.
- **Package manager**: pnpm. **Identifier**: `com.fluentsoundswitcher.app`
  (config at `%APPDATA%/com.fluentsoundswitcher.app/config.json`).

## Status

Phases 0–8, 10, 11 done; the app is feature-complete and builds installers.
Remaining: code signing + auto-update rollout (workflow wired, key not yet
generated) and per-app profiles (Phase 9, experimental, deferred). The phase
numbering in `CHANGELOG.md` is the source of truth.

## Commands

```bash
pnpm install        # install JS deps
pnpm tauri:dev      # run the app (Tauri dev, launches vite + rust)
pnpm tauri:build    # production bundle (msi + nsis)
pnpm lint           # tsc --noEmit (frontend typecheck)
# backend check:
cargo check --manifest-path src-tauri/Cargo.toml
```

## Layout

- `src/` — React frontend.
  - `main.tsx` branches the render on `getCurrentWindow().label`
    (`overlay`/`flyout`/`banner`/`main`) and sets `data-window` on `<html>`.
  - `App.tsx` (main window), `views/` (`DeviceList`, `SettingsDialog` tabbed,
    `Overlay`, `Flyout`, `Banner`), `components/` (`HotkeyInput`).
  - `hooks/` — `useDevices`, `useFavorites`, `useHotkeys`, `useMute`,
    `useMuteIndicator`, `useNotifications`, `useAutoSwitch`, `useGeneral`.
  - `lib/tauri.ts` (invoke wrappers), `lib/config.ts` (store wrapper + types),
    `theme/` (Fluent theme + OS sync), `i18n/locales/*.json`.
  - `styles.css` scopes the transparent/centered aux-window CSS via
    `:root[data-window="…"]` so it doesn't leak into the main window.
- `src-tauri/src/` — Rust.
  - `audio/` — isolated Core Audio module: `enumerator.rs` (list + default
    output), `policy.rs` (`IPolicyConfig` switch), `volume.rs` (mic mute),
    `events.rs` (`IMMNotificationClient`), `mod.rs` (`ensure_com`,
    `cycle_default`). `sessions.rs` (per-app) not built yet.
  - Windows: `overlay.rs` (mute indicator), `banner.rs` (switch banner),
    `flyout.rs` (tray quick-switch) — all transparent/topmost/click-through.
  - `tray.rs` (two tray icons: mic + output device), `device_icon.rs` (extract
    the Windows endpoint icon → RGBA), `mute.rs` (central mute state),
    `notify.rs` (toast/banner/sound), `hotkeys.rs` (global shortcuts),
    `cli.rs` (subcommands), `config.rs` (reads the store file), `commands.rs`,
    `lib.rs` (builder/setup), `main.rs` (CLI dispatch then `run`).

## Key technical notes

- Setting the default device is **not** a public API: uses the undocumented COM
  `IPolicyConfig` (CLSID `{870af99c-171d-4f9e-af0d-e63df40c2bc9}`, IID
  `f8679f50-850a-41cf-9c72-430f290290c8`), declared via `#[interface]` — sets all
  three roles. Validated in Phase 1.
- `#[interface]`/`#[implement]` macros need `windows-core` as a **direct** dep so
  generated `::windows_core` paths resolve.
- Device monitoring: `IMMNotificationClient` (`audio/events.rs`) registered for
  the process lifetime (leaked, never unregistered). `OnDefaultDeviceChanged`
  (console role) mirrors external changes to the GUI (`device-changed` event) and
  refreshes the output tray icon — single chokepoint for any switch
  (ours/hotkey/CLI/sound-panel). Setting the default never loops there (the
  callback only mirrors). Optional auto-switch happens on device arrival.
- Output tray icon (`device_icon.rs`): reads the endpoint icon-path property
  (best-effort key, `SHDefExtractIconW` → `HICON` → RGBA via GetDIBits, BGRA→RGBA),
  falls back to the app icon.
- The aux windows must be topmost + click-through (`WS_EX_NOACTIVATE |
  WS_EX_TOOLWINDOW`, `set_ignore_cursor_events`, `always_on_top`) so they render
  over fullscreen games — the SoundSwitch fix. Positioned via the work area
  (`SystemParametersInfoW SPI_GETWORKAREA`). Pattern from sibling
  `ponto-app/src-tauri/src/overlay.rs`.
- HWND version mismatch: `window.hwnd()` returns a `windows` 0.61 HWND; rebuild as
  our 0.58 HWND with `HWND(raw.0)` (0.58 HWND is `*mut c_void`).
- The backend reads config straight from the store file (`config.rs`) instead of
  IPC. The store autosaves **asynchronously**, so any setting that must apply
  immediately is passed directly as a command argument (don't re-read the file) —
  e.g. `refresh_mute_indicator`, `update_hotkeys`, `set_device_icon`.
- Dual GUI/CLI binary: `main.rs` parses argv first; `cli::run_if_cli` filters
  `--autostart`, `AttachConsole(ATTACH_PARENT_PROCESS)` for output, returns an
  exit code when a subcommand ran. `#![windows_subsystem = "windows"]` in release.
- WebView2 auto-darkens controls in dark mode; `index.html` + the theme pin
  `color-scheme` to the resolved theme to stop it.

## Working style

- Phased iterations. One phase per iteration, commit at the end of each.
- Update `CHANGELOG.md` per phase and keep this file current.
- App icons live in `src-tauri/icons/`, generated from `icons/logo.svg` via
  `pnpm tauri icon icons/logo.svg` (regenerate after editing the SVG). The tray
  mic-state icons (`mic-on.png`/`mic-off.png`) are separate and hand-made.
