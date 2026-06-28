<div align="center">

# 🔊 Fluent Sound Switcher

**Switch your Windows 11 audio devices instantly — with a UI that actually looks like Windows 11.**

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Fluent UI](https://img.shields.io/badge/Fluent_2-design-0078D4?logo=microsoft&logoColor=white)](https://fluent2.microsoft.design/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

</div>

> ⚠️ **Early development.** Built in phased iterations — see the roadmap below.

A modern, lightweight alternative to [SoundSwitch](https://github.com/belphemur/soundswitch)
for Windows 11. Same core idea — quickly switch playback/recording devices and
toggle your mic — but built on [Tauri](https://tauri.app) with a native-feeling
[Fluent 2](https://fluent2.microsoft.design/) interface, and it fixes the
fullscreen overlay problem that hides notifications behind the taskbar in apps
like Steam Big Picture.

## ✨ Planned features

- 🔁 Switch between a curated list of input/output devices (pick which ones show up).
- ⌨️ Customizable global hotkeys to cycle devices and toggle mute.
- 🎙️ Mic mute with configurable status indicators (tray icon + optional on-screen banner).
- 🖥️ On-screen overlay that stays visible **over fullscreen games**.
- 📍 Tray icon reflecting the current device and mute state.
- 🗂️ Per-app audio profiles *(experimental, later phase)*.
- 🔔 Switch notifications: native toast, on-screen banner, or sound.
- 🧰 CLI with the same actions as the GUI.
- 🌍 Multi-language — **pt-BR** (default) and **en**.
- 💾 Local config stored in AppData.

## 🛠️ Tech stack

| Layer    | Tech                                              |
| -------- | ------------------------------------------------- |
| Shell    | Tauri v2                                          |
| Frontend | React 19 + Vite 6 + TypeScript + Fluent UI React v9 |
| Backend  | Rust + `windows` crate (Core Audio / COM)         |
| i18n     | react-i18next                                     |
| Config   | Tauri `store` plugin                              |

## 🚀 Development

```bash
pnpm install
pnpm tauri:dev      # run the app
pnpm tauri:build    # build installers (msi + nsis)
```

Requires Node, pnpm, and the Rust toolchain (Windows 11 target).

## 🗺️ Roadmap

| Phase | Scope |
| ----- | ----- |
| 0 ✅ | Scaffold & infra (Tauri + React + Fluent + i18n) |
| 1     | Audio core — enumerate + switch default device (de-risk) |
| 2     | Device list management & filtering |
| 3     | Global hotkeys |
| 4     | Mic mute + status overlay (fullscreen-safe) |
| 5     | Switch notifications (toast / banner / sound) |
| 6     | Full settings UI |
| 7     | CLI parity |
| 8     | Per-app audio profiles (experimental) |
| 9     | Auto-switch on monitor/TV connect (optional) |
| 10    | Polish, branding, GitHub Actions release + auto-update |

## 📄 License

[MIT](./LICENSE) © Gabriel Leocadio
