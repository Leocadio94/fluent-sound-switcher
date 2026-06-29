# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
the project follows phased iterations (see `README.md`).

## [Unreleased]

### Phase 8 — CLI parity
- The same binary doubles as a CLI: launched with a subcommand it runs that and
  exits without starting the GUI (audio ops are global COM calls, so it works
  standalone). Attaches to the parent console for output.
- Commands: `list [output|input]`, `switch <id|name>`, `cycle <output|input>`,
  `mute [toggle|on|off]`, `--version`, `--help`. `cycle` reads the same favorites
  the GUI stores.

### Phase 7 — Full settings & autostart
- Reorganized settings into a tabbed dialog: General, Hotkeys, Mute indicator,
  Notifications. Moved language and theme out of the header into General,
  decluttering the toolbar.
- "Start with Windows" (autostart plugin) and "Start minimized to tray": when
  auto-launched with `--autostart` and start-minimized is on, the main window
  stays hidden in the tray.
- Fixed the auxiliary windows' transparent/centered CSS leaking into the global
  bundle and shrinking the main window (a black gutter on the left). The rules
  are now scoped per window via a `data-window` attribute.

### Phase 6 — Device-change notifications
- When the default device changes (hotkey cycle or flyout pick), notify via any
  combination of: an on-screen banner (transient, topmost, fullscreen-safe), a
  native Windows toast, and/or a short sound (bundled wav via `PlaySound`).
- Each channel is individually toggleable, with a configurable banner position
  and a "test notification" button; all persisted.
- Manual switches in the main window don't notify (the `notify` flag is only set
  for hotkey/flyout switches).

### Phase 5 — Tray quick-switch flyout & menu
- Left-clicking the tray icon opens a compact quick-switch flyout listing the
  favorite output/input devices; picking one switches and closes it. It is an
  always-on-top, taskbar-anchored window that stays usable over fullscreen apps
  (the popup SoundSwitch hides behind the taskbar), and dismisses on blur.
- Auto-sizes to its content; positioned above the taskbar via the work area.
- Expanded the right-click tray menu: Open, Settings (opens the main window and
  the settings dialog), Playback devices (Windows sound panel), toggle mute,
  Quit.
- Flyout gained a mute/unmute button; it re-syncs device and mute state each
  time it opens (the webview is suspended while hidden).
- Closing the main window now hides it to the tray instead of quitting, so the
  tray "Open" reliably brings it back.

### Phase 4 follow-ups
- Mute overlay no longer clips its glow at the bottom (centered in a taller
  window) and refreshes immediately when its settings change (config passed
  directly to avoid racing the store write).
- Overlay style option: full (icon + text) or icon-only.

### Phase 4 — Mic mute & status overlay
- Tray icon now reflects the mic mute state (mic-on / mic-off icons) with a
  matching tooltip, plus a "toggle mute" menu item.
- On-screen mute overlay: a transparent, click-through, always-on-top window
  that survives fullscreen apps. Configurable visibility (always / only muted /
  only live / never) and screen position; persisted.
- Header mic button reflecting/toggling mute, and a Settings dialog (replacing
  the hotkeys-only dialog) with hotkeys + mute-indicator sections.
- Central mute state (`mute.rs`) keeps tray, overlay and frontend in sync via
  the `mic-mute-changed` / `overlay-state` events.

### Phase 3 — Global hotkeys
- Global shortcuts (tauri-plugin-global-shortcut) for: cycle output, cycle
  input, toggle mic mute. Defaults: Ctrl+Alt+F11 / F12 / M.
- Cycle walks the persisted favorites in order (wraps around); falls back to all
  active devices when no favorites are set.
- Backend reads the store file directly for favorites/bindings (`config.rs`),
  emits `device-changed` / `mic-mute-changed`; the UI refreshes on those.
- Mic mute core via `IAudioEndpointVolume` (`audio/volume.rs`).
- Hotkeys editor dialog with a key-capture input; bindings persist to the store
  and re-register the shortcuts live.

### Phase 2 — Device list management
- Per-device favorite toggle (star) marking which devices join the cycle list
  used by hotkeys later; persisted to an AppData store (`config.json`).
- "Favorites only" filter switch, also persisted.
- Refactored device rows to separate the switch action from the favorite/badge
  controls; added `lib/config.ts` (store wrapper) and the `useFavorites` hook.

### Phase 1 — Audio core
- Added the isolated `audio/` module (Windows Core Audio over COM):
  - `enumerator.rs` lists active output/input endpoints with friendly names and
    flags the current defaults.
  - `policy.rs` switches the default device for all roles via the undocumented
    `IPolicyConfig` COM interface (declared with the `windows` crate).
- Exposed `list_audio_devices` / `set_default_audio_device` Tauri commands.
- Frontend device list (Fluent UI) with clickable rows, active-device badge,
  per-row switching spinner, refresh, and an error MessageBar.
- Minimal system tray (Show / Quit).
- Pinned the document `color-scheme` (synced to the resolved theme) so WebView2
  stops auto-darkening controls — dropdowns rendered light in dark mode.

### Phase 0 — Scaffold & infra
- Bootstrapped Tauri v2 + React 19 + Vite 6 + TypeScript (pnpm) project.
- Added Fluent UI React v9 with light/dark theme that follows the OS color scheme.
- Added i18n (react-i18next) with pt-BR (default) and en locales.
- Wired the `store` plugin for local config (AppData).
- Minimal backend shell with a `ping` command.
- Project docs: MIT `LICENSE`, `CHANGELOG.md`, `CLAUDE.md`, initial `README.md`.

> Icons are temporary placeholders copied from a sibling project; real branding
> lands in Phase 10.
