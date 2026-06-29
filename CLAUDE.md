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
- **Backend**: Rust (Tauri v2). Windows audio via the `windows` crate
  (Core Audio COM) — added in Phase 1.
- **Config**: Tauri `store` plugin (JSON in AppData).
- **Package manager**: pnpm.

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

- `src/` — React frontend. `theme/` (Fluent theme + OS sync), `i18n/`,
  `components/`, `views/`, `hooks/`, `lib/` (Tauri invoke wrappers).
- `src-tauri/src/` — Rust. `audio/` is the isolated Core Audio module
  (enumerator, policy/IPolicyConfig, volume, sessions, events). `commands.rs`,
  `tray.rs`, `hotkeys.rs`, `cli.rs`, `config.rs`, `lib.rs`.

## Key technical notes

- Setting the default device is **not** a public API: uses the undocumented COM
  `IPolicyConfig` (CLSID `{870af99c-171d-4f9e-af0d-e63df40c2bc9}`). Validated in
  Phase 1 — if it fails, fall back to a .NET sidecar.
- The fullscreen overlay must be topmost + click-through
  (`WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT`) so it renders above
  fullscreen games. Reference pattern in the sibling `ponto-app/src-tauri/src/overlay.rs`.

## Working style

- Phased iterations. One phase per iteration, commit at the end of each.
- Update `CHANGELOG.md` per phase and keep this file current.
- App icons live in `src-tauri/icons/`, generated from `icons/logo.svg` via
  `pnpm tauri icon icons/logo.svg` (regenerate after editing the SVG). The tray
  mic-state icons (`mic-on.png`/`mic-off.png`) are separate and hand-made.
