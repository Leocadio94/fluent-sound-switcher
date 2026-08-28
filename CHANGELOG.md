# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
the project follows phased iterations (see `README.md`).

## [0.2.0] - 2026-08-28

<!-- release-notes -->
The first release since the auto-updater started working — if you are on 0.1.x,
this is the one that reaches you.

**Volume, finally.** Every device gets a volume slider: the one you are using
keeps it open, the rest a click away. You can mute outputs, not just the
microphone, and bind hotkeys for volume up/down and output mute — media keys
included. A volume OSD shows the level over fullscreen games, like the mute
indicator already did.

**Fixes that matter if you have more than one screen or more than one mic**

- The floating windows (mute indicator, switch banner, volume OSD, tray flyout)
  went to the primary monitor no matter what. They now follow your cursor, and
  Settings lets you pin them elsewhere.
- Switching your default microphone left the tray icon and the overlay showing
  the *old* mic's mute state.
- A hotkey another app had already claimed failed silently and looked like it
  worked. The Hotkeys tab now tells you which ones did not register.
- Renaming a device in the Windows sound panel left the old name in the list.
- Your theme and language reset to the defaults on every launch.
- The tray menu and the notifications were Portuguese regardless of the language
  you picked.

**Also**

- The device list is tighter: no more "Active" badge repeating what the
  highlight already says.
- A log file you can open from Settings → General, for when something needs
  reporting.
- Under the hood: logging throughout, CI on every push, and the first tests in
  the project.

<!-- /release-notes -->

### Phase 17 — Device list polish

Feedback on the Phase 16 UI, verified by screenshotting the running app rather
than reasoning about the markup.

- **The "Active" badge is gone.** The brand border and background already say
  which device is in use, so the labelled badge was saying it twice. It is now
  the same discreet check the flyout uses — colour alone does not carry for
  everyone, so something non-colour had to stay.
- **The volume slider no longer stretches every row.** The volume worth
  reaching for is almost always the one on the device actually in use, so that
  row keeps its slider open and the others expand from a chevron. It sits
  beside the favourite star and does not interfere with picking a device: the
  name is still the button that switches.
- **The app name is out of the window body.** The native title bar already
  carries it, along with the same icon, so the header is now a plain toolbar.
  The "favorites only" switch moved up into it, removing a row of its own.
- The slider spans the row, with the level readout in the same column as the
  favourite star, so the row has a straight trailing edge. (It was briefly
  capped at 280px on the theory that a full-width slider reads as a progress
  bar; on screen that just left a wide gap and stranded the number mid-row.)
- **The check and the chevron now line up.** They sit in the same column but
  had different widths (an 18px icon against a 28px button), so the two
  staggered down the list. Both occupy one 28px slot now.
- **Fixed the mute overlay drawing its full-width face inside the icon-only
  window**, clipping the label. The window is created hidden, so its WebView2
  renderer is frozen and can drop every `overlay-state` event pushed at it; the
  component then kept its initial guess forever. It now asks the backend for the
  real state on mount (`get_overlay_state`) instead of depending on having
  caught an event.

### Phase 16 — Volume: the UI

Phase 15 gave the backend everything it needed; this is where it becomes
something you can see and use.

- **A volume slider on every device row**, with a mute button and a level
  readout. It lives in the shared `DeviceRow`, so the main list and the tray
  flyout get it from one implementation. Levels are read on demand rather than
  folded into `list_audio_devices`: that would mean activating an
  `IAudioEndpointVolume` interface for every endpoint on every refresh, and the
  list is refetched on each `device-changed`.
- Dragging writes on a 40 ms debounce — the slider moves immediately, the device
  is not asked to change once per pixel.
- **The volume OSD renders**: a level bar in the overlay window, appearing over
  fullscreen games like the mute indicator does. The overlay now switches on the
  `kind` field of its payload.
- **Media keys can be bound.** `toAccelerator` accepted only letters, digits and
  function keys, all requiring a modifier, so the new volume actions had no key
  anyone would want to use. Media keys are now accepted bare (they cannot be
  typed by accident) along with the navigation keys, and the Hotkeys tab warns
  that binding one takes it away from Windows while the app runs.
- **A Volume tab** in settings: OSD on/off and position, sliders in the list,
  sliders in the flyout (off by default — the tray menu is deliberately tight).

### Phase 15 — Volume: the backend

The app could switch devices and mute the microphone, and that was the whole
extent of its relationship with volume. `IAudioEndpointVolume` was already being
activated, but only `GetMute`/`SetMute` were ever called, on the default capture
endpoint alone.

- **`audio/volume.rs` now works on any device, in either direction.**
  `get_volume` / `set_volume` (clamped — the value comes from a slider) /
  `step_volume` / `toggle_mute` / `is_muted` / `set_mute`, each taking an
  optional device id and falling back to that direction's default endpoint.
  `step_volume` uses `VolumeStepUp`/`VolumeStepDown` rather than adding a fixed
  amount, so the increment is the one Windows itself uses for that endpoint.
- **Output mute exists.** `MuteState` held a single flag, so there was nowhere
  to put it; it now tracks the microphone and the default output separately,
  with an `output-mute-changed` event.
- **Volume changed elsewhere is mirrored** (`audio/volume_events.rs`): an
  `IAudioEndpointVolumeCallback` on the default output emits `volume-changed`,
  so the keyboard volume wheel and the Windows mixer no longer leave the app
  showing a stale level. It is re-armed when the default output changes — the
  callback is bound to one endpoint — and the previous registration is undone so
  they do not accumulate. Like the device notifications, the handler only reads
  a value and hands it off; it does no COM work on the audio thread.
- **Three new hotkey actions**: volume up, volume down and toggle output mute.
  They default to *unbound* on purpose: registering the media keys globally
  takes them away from Windows, so it has to be the user's choice.
- **Volume OSD**, reusing the existing overlay window rather than adding a fifth
  WebView2 instance: the payload is now discriminated (`kind: "mute" |
  "volume"`), the OSD auto-hides after 1.5 s and then restores the mute
  indicator. A generation counter keeps a burst of volume presses from having
  the first one hide what the last one is showing.
- New commands: `get_device_volume`, `set_device_volume`, `toggle_device_mute`,
  `get_device_muted`, `toggle_output_mute`, `get_output_muted`.

Note on `unsafe`: the volume registration is kept in a static so it can be
undone, and COM interfaces are not `Send`. It is wrapped in a newtype with an
explicit `unsafe impl Send`, justified by `ensure_com` initialising COM as
`COINIT_MULTITHREADED` (no thread affinity) and by every access going through
the mutex that holds it.

### Phase 14 — Frontend correctness & structure

#### Fixes
- **Settings wrote to disk twice per change.** Five hooks called `save(...)`
  *inside* a `setState` updater. Updaters must be pure, and React 19 runs them
  twice under StrictMode, so every toggle wrote the config twice and fired its
  backend command twice (re-registering hotkeys, re-applying the overlay). The
  new value is now derived from a ref and persisted outside the updater.
- **The refresh button gave no feedback.** `loading` was only ever set to
  `false`, so it never returned to `true` and the button never disabled. A
  background refresh (from a `device-changed` event) deliberately skips the
  flag, so the list the user is reading does not blank out.
- **A pending switch froze the whole list.** Every row was disabled while any
  device was switching; only the row being switched is now.
- **Errors were shown as raw COM text in English.** Failures now map to a
  translated sentence with a "try again" button, keeping the backend message as
  secondary detail for a bug report. The flyout discarded errors entirely, so a
  failure there looked like "no favorites".
- **The mute overlay and the switch banner ignored the theme.** Their colours
  were hardcoded hex in plain CSS, so they were always dark. Both use Fluent
  tokens now, and the overlay finally renders inside a `FluentProvider` like the
  other windows.

#### Structure
- New `DeviceRow` is shared by the main list and the tray flyout, which had
  hand-rolled two copies of the same markup and near-identical style blocks.
- `SettingsDialog` went from 415 lines and fourteen drilled props to a 147-line
  shell over four tab components. Its panel no longer changes height between
  tabs.
- New `usePersistedConfig` and `useTauriEvent` replace the load/save and
  listen/unlisten boilerplate repeated across the hooks.

#### Config
- The store is versioned (`schemaVersion`) with a migration hook, and every
  value is validated on read. Loading used to be a shallow merge with no
  checking, so a hand-edited or downgraded `config.json` could hold
  `"position": "middle"` and hand it straight to the backend. The option lists
  are exported once and used by both the dropdowns and the validation.
- `startMinimized`, `showDeviceIcon` and `overlayMonitor` were missing from the
  store defaults, so a fresh `config.json` did not contain them.

#### Translations
- `t()` keys are now type-checked against the catalogue, and en.json is held to
  pt-BR's exact shape at compile time — a missing or misspelled key used to
  render as the raw key at runtime. Turning this on immediately caught
  `settings.deviceIcon`, which does not exist (the key is `showDeviceIcon`).
- Removed five keys referenced nowhere; moved the shared anchor points to their
  own `positions` namespace (the banner dropdown was borrowing the mute
  overlay's); `hotkeys.close` labelled the dialog's close button and is now
  `common.close`; nested the theme labels, which were flattened
  `"theme.system"` keys that only resolved by accident.

#### Accessibility
- `aria-pressed` on the favorite star and the mute toggles, `aria-current` on
  the active device, `aria-label` on the icon-only header buttons, list
  semantics on the device sections, and a visible focus ring on the custom
  buttons, which had none once their border was cleared.

#### Tests
- Vitest, with 14 tests covering the config validation/migration and the
  accelerator parsing. `pnpm test` runs in CI.

### Phase 13 — Backend correctness

#### Fixes
- **Changing the default microphone left the mute state stale.**
  `OnDefaultDeviceChanged` only handled `eRender`, so after switching mics the
  tray icon and the on-screen overlay kept reporting the *previous* device's
  mute status until something else refreshed it. The capture branch now calls
  `mute::refresh`.
- **The floating windows ignored every monitor but the primary one.** The mute
  overlay and the switch banner positioned themselves from `primary_monitor()`
  with a hardcoded 1920x1080 fallback, and the flyout read `SPI_GETWORKAREA`,
  which is also primary-only. On a multi-monitor setup they appeared on the
  wrong screen — for windows whose entire purpose is being visible over the
  fullscreen game in front of you. New `auxwin.rs` resolves the target monitor's
  work area (and its real scale factor), with a new "Monitor for floating
  windows" setting: follow the cursor (default), the primary monitor, or the
  monitor of the focused window.
- **Renaming a device did nothing.** `OnPropertyValueChanged` was a no-op, so a
  device renamed in the sound panel kept its old name in the list. It now
  refreshes on `PKEY_Device_FriendlyName`, debounced because Windows fires those
  notifications in bursts.

#### Windows audio callback thread
- The `IMMNotificationClient` handlers ran everything inline on the Windows
  audio service's thread: a single device arrival did three config-file reads,
  two COM enumerations and a default-device switch, which Microsoft explicitly
  warns against. Handlers now capture what they need and hand the work to a
  blocking task.

#### Performance
- `config.rs` re-read *and* re-parsed the whole store file on every getter — one
  device switch cost three full reads, some from that COM callback. It now
  caches the parsed document and only re-reads when the file's mtime moves.

#### Translations
- The tray menu, its tooltips, the notification titles and all ten updater
  messages were hardcoded in pt-BR, so an English user got a half-translated
  app. New `i18n.rs` holds them, keyed off the frontend's `language`; switching
  the language rebuilds the tray immediately (`set_language`).
- **Language and theme now persist.** Both lived in component state only and
  reset to the defaults on every launch, and the flyout/banner windows hardcoded
  "system" no matter what was chosen. They are read before the first render, and
  `<html lang>` follows the active language instead of being pinned to pt-BR.

#### Housekeeping
- The CLI reimplemented the store path and the favorites parsing; both now come
  from `config` (the CLI still derives its app-data dir from `%APPDATA%`, having
  no `AppHandle`).
- First unit tests in the project (`i18n.rs` language fallback).
- Fixed a `clippy::chunks_exact_to_as_chunks` failure in `device_icon.rs`; the
  CI toolchain is newer than the local one and caught it first.

### Phase 12 — Observability & CI

Foundation work for V2: the app could not be debugged from a user report, and
nothing verified the code outside a release tag.

#### Logging
- Added `tauri-plugin-log` (`logging.rs`): a rotating file in the app log dir
  (2 MiB, `KeepOne`), plus stdout in dev builds. The GUI binary is
  `windows_subsystem = "windows"`, so the three `eprintln!` it had went nowhere.
- Replaced the failures that used to vanish into `let _ =` with real log lines:
  a `CoInitializeEx` error (as opposed to the benign `S_FALSE`/
  `RPC_E_CHANGED_MODE`), a corrupt `config.json` silently reverting every
  setting to its default, `SPI_GETWORKAREA` failing and parking the flyout at
  0,0, failed tray icon/tooltip updates, a failed auto-switch, native toasts and
  the switch sound, and every updater step.
- New "Abrir pasta de logs" button in Settings → General (`open_log_folder`
  command, `ShellExecuteW` — no extra plugin).

#### Hotkeys that silently did not register
- `hotkeys::register_with` used to return `Ok(())` no matter what, so a binding
  already owned by another app was shown in the UI as if it worked. It now
  returns the bindings that failed, with a reason; `update_hotkeys` passes them
  to the frontend, which warns in the Hotkeys tab.
- The action map is no longer locked while calling the OS `register`/
  `unregister` (which blocks and needs the same lock to dispatch), and a
  poisoned mutex is recovered instead of aborting the process under
  `panic = "abort"`.

#### CI
- New `ci.yml` on push/PR: typecheck, frontend build, `cargo fmt --check`,
  `clippy -D warnings` and `cargo test`. Nothing ran outside a tag before.
- `release.yml` now verifies the tag matches all three version manifests
  (`scripts/check-version.mjs` — the updater compares versions, so a mismatch
  breaks update checks), builds the release body from the `CHANGELOG.md` section
  for the version plus a download table, the SmartScreen note and a compare link
  (`scripts/release-notes.mjs`), runs the CI checks before building, and
  publishes a `SHA256SUMS.txt`.
- `release.yml` also forces the release out of draft after building. This is
  what was actually broken: `tauri-action` reuses an existing release for a tag
  and never promotes a pre-existing draft, so v0.1.1 and v0.1.2 stayed drafts —
  GitHub excludes those from `releases/latest`, so `latest.json` 404'd and
  *every* update check failed while the workflow reported success. Found by the
  new logging on its first run; v0.1.2 has been published.
- Added `rustfmt.toml` and normalized the existing formatting.

### Fixes
- **No more window flash when starting with Windows.** The `main` window was
  created with `visible: true` and only hidden later from `setup()`, so an
  auto-start at login painted the window on screen before it vanished. It is now
  created with `visible: false` and revealed by a new `main_window_ready`
  command that the React root calls after its first render — which also removes
  the blank-white frame on a normal launch. "Iniciar minimizado" is decided in
  `setup()` (stored as `StartHidden`) and simply skips the reveal.

### Auto-update
- The repository is public, so the updater talks to GitHub Releases directly
  (`releases/latest/download/latest.json`) — no token or proxy needed.
- The release workflow now **publishes** instead of drafting the release
  (`releaseDraft: false`, `includeUpdaterJson: true`). GitHub excludes drafts
  from `releases/latest`, so a draft made every client's check 404 until it was
  manually published.
- Updates no longer install themselves behind the user's back. A check only
  detects and reports (toast + an update bar in the main window); **Atualizar
  agora** does the download/install/restart. The tray check also brings the main
  window forward on a hit.
- The silent startup check retries (15s/30s) while the network comes up at
  login, instead of failing once and staying quiet until the next launch.

### Docs
- Added `AGENTS.md` pointing AI coding agents at `CLAUDE.md`, with the command
  quick reference and the project ground rules.

## [0.1.2]

### Fixes
- Overlays (mic-mute indicator and device-change banner) appeared inconsistently.
  Each aux window is created hidden, so its WebView2 renderer is frozen and
  resumes asynchronously on `show()`; a state event fired at the frozen renderer
  could be dropped, leaving the window shown but blank (transparent). The overlay
  also emitted its state *before* `show()` with no retry. Both now emit *after*
  show and re-push the payload a few times (~0.7s) so the resuming renderer
  reliably paints.

### Auto-update (Phase 11 follow-up)
- Wired `tauri-plugin-updater`: the release workflow produces signed update
  artifacts + a `latest.json`, the public key lives in `tauri.conf.json`, and the
  endpoint points at the GitHub Releases `latest` download.
- A silent check runs on startup; the tray gains a "Verificar atualizações" item.
  On a newer signed version the app downloads, installs and restarts, notifying
  along the way.
- Bumped to `0.1.1` for the first tagged release.

### Phase 11 — Branding & distribution
- New visual identity: a Fluent squircle icon (speaker + swap arrows, blue→teal
  gradient) generated from `icons/logo.svg` into the full icon set; updated the
  bundle icon list and the web favicon. Removed the placeholder icons.
- Rewrote the README around the now-shipping features, with install (and a
  SmartScreen note), hotkey/CLI usage, and release instructions.
- Added a GitHub Actions release workflow (`.github/workflows/release.yml`):
  pushing a `v*` tag builds the Windows installers and publishes a draft
  release. Updater signing is wired via secrets but stays off until a key and
  `plugins.updater.pubkey` are configured.

### Phase 10 follow-ups
- Device-change banner now fires on manual in-app switches too, not only
  hotkey/flyout switches.
- Optional second tray icon mirroring the current default output device, using
  the icon Windows shows for it in the Sound control panel (extracted from the
  endpoint's icon path; falls back to the app icon). Tooltip shows the device
  name. The mic stays the primary icon. Toggle in Settings → General; on by
  default. Updates on every default-output change (ours, the CLI, or external).

### Phase 10 — Auto-switch on connect & live external-change sync
- Backend now watches audio device arrivals/removals via `IMMNotificationClient`
  (`audio/events.rs`), registered for the process lifetime.
- Optional auto-switch: when an output device connects (e.g. a TV or monitor
  with audio is plugged in), it can grab the system default. Configurable via a
  master toggle plus a rule — "favorites only" (default) or "any device". Off by
  default. Setting the default never loops (the resulting default-changed
  callback only mirrors, never switches), and the add/state-changed double event
  is idempotent (already-default is skipped).
- Bonus regardless of auto-switch: external default-device changes (Windows
  sound panel, the CLI, another app) now refresh the open GUI live, so the
  active badge and tray stay current.
- (Phase 9 — per-app audio profiles — deferred.)

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
