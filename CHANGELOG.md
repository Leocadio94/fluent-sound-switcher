# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
the project follows phased iterations (see `README.md`).

## [Unreleased]

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
