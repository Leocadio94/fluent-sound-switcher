<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="120" alt="Fluent Sound Switcher" />

# Fluent Sound Switcher

**Switch your Windows 11 audio devices instantly — with a UI that actually looks like Windows 11.**

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Fluent UI](https://img.shields.io/badge/Fluent_2-design-0078D4?logo=microsoft&logoColor=white)](https://fluent2.microsoft.design/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/Leocadio94/fluent-sound-switcher?include_prereleases&sort=semver)](https://github.com/Leocadio94/fluent-sound-switcher/releases)

</div>

A modern, lightweight alternative to [SoundSwitch](https://github.com/belphemur/soundswitch)
for Windows 11. Same core idea — quickly switch playback/recording devices and
toggle your mic — but built on [Tauri](https://tauri.app) with a native-feeling
[Fluent 2](https://fluent2.microsoft.design/) interface. It also fixes
SoundSwitch's long-standing annoyance where the on-screen popup hides **behind
the taskbar in fullscreen apps** like Steam Big Picture — our overlay renders on
top, every time.

> ⚠️ **Early development (`0.1.x`).** Functional and usable, polishing toward a
> first release. Built in phased iterations.

## 📸 Screenshots

<div align="center">

![Main window — device list with favorites, active device, and header controls](docs/screenshots/main.png)

</div>

<div align="center">

<img src="docs/screenshots/settings.png" width="49%" alt="Settings — General tab" />
<img src="docs/screenshots/hotkeys.png" width="49%" alt="Settings — Hotkeys tab" />

</div>

## ✨ Features

- 🔁 **Switch** output/input devices from a curated favorites list (you choose which show up).
- ⌨️ **Global hotkeys** to cycle output, cycle input, and toggle mic mute — fully rebindable.
- 🎙️ **Mic mute** with a configurable on-screen indicator (always / only-muted / only-live / never) and a tray icon that reflects the state.
- 🖥️ **Fullscreen-safe overlay & banner** — topmost and click-through, visible *over* fullscreen games.
- 🟦 **Tray quick-switch flyout** (left-click) and a context menu (right-click); works over fullscreen apps.
- 🔔 **Switch notifications** — any mix of a native Windows toast, an on-screen banner, and a sound.
- 🔌 **Auto-switch on connect** *(optional)* — plug in a TV/monitor with audio and it can grab the default output.
- 🖼️ **Output-device tray icon** *(optional)* — a second tray icon mirroring the current output, using the icon Windows shows for it.
- 🧰 **CLI** with the same actions as the GUI (`list`, `switch`, `cycle`, `mute`).
- 🚀 **Start with Windows** (optionally minimized to tray).
- 🌍 **Multi-language** — **pt-BR** (default) and **en**.
- 💾 Local config in `%APPDATA%`, no account, no telemetry.

## 📦 Install

Grab the latest installer from the [**Releases**](https://github.com/Leocadio94/fluent-sound-switcher/releases) page:

- **`.msi`** (Windows Installer) or **`.exe`** (NSIS setup) — either works.

> 🛡️ **SmartScreen note:** the binaries are not code-signed yet, so Windows
> SmartScreen may warn on first run. Click **More info → Run anyway**. (Code
> signing is on the roadmap.)

## 🎮 Usage

### Hotkeys (defaults — change them in Settings)

| Action            | Shortcut        |
| ----------------- | --------------- |
| Cycle output      | `Ctrl+Alt+F11`  |
| Cycle input       | `Ctrl+Alt+F12`  |
| Toggle mic mute   | `Ctrl+Alt+M`    |

Cycling walks your favorites in order (wraps around); with no favorites set it
falls back to all active devices.

### Tray

- **Left-click** — quick-switch flyout (favorites + mute toggle).
- **Right-click** — Open, Settings, Playback devices, toggle mute, Quit.

### CLI

The same executable doubles as a CLI — run it with a subcommand and it performs
the action and exits without opening the GUI:

```powershell
fluent-sound-switcher list [output|input]   # list devices (id, name, * = default)
fluent-sound-switcher switch <id|name>      # set default device (matches by id or name)
fluent-sound-switcher cycle <output|input>  # cycle to the next favorite
fluent-sound-switcher mute [toggle|on|off]  # microphone mute (default: toggle)
fluent-sound-switcher --version
fluent-sound-switcher --help
```

## 🛠️ Tech stack

| Layer    | Tech                                                |
| -------- | --------------------------------------------------- |
| Shell    | Tauri v2                                             |
| Frontend | React 19 + Vite 6 + TypeScript + Fluent UI React v9  |
| Backend  | Rust + `windows` crate (Core Audio / COM)           |
| i18n     | react-i18next                                        |
| Config   | Tauri `store` plugin (`%APPDATA%/com.fluentsoundswitcher.app/config.json`) |

Switching the default device uses the undocumented `IPolicyConfig` COM interface
(the same mechanism the Windows Sound control panel uses); device-arrival
monitoring uses `IMMNotificationClient`.

## 🚀 Development

```bash
pnpm install
pnpm tauri:dev      # run the app (Vite + Rust)
pnpm tauri:build    # build installers (msi + nsis)
pnpm lint           # frontend typecheck (tsc --noEmit)
cargo check --manifest-path src-tauri/Cargo.toml   # backend check
```

Requires Node, pnpm, and the Rust toolchain on a Windows 11 target.

## 🚢 Releases

Tagging a commit `v*` (e.g. `v0.1.0`) triggers the
[release workflow](.github/workflows/release.yml): it builds the Windows
installers and publishes them to a GitHub Release.

Auto-update is configured (`tauri-plugin-updater`): the updater public key is in
`tauri.conf.json`, the endpoint points at the GitHub Releases `latest.json`, and
the workflow signs the artifacts. The app checks on startup and via the tray's
**Verificar atualizações** item.

<details>
<summary>One-time maintainer setup</summary>

The release signing key is held outside the repo. Add the private key as a repo
secret so CI can sign updates (the public key is already committed):

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/fss-updater.key
# the key was generated with an empty password, so no password secret is needed
```

To rotate the key: `pnpm tauri signer generate -w ~/.tauri/fss-updater.key -f`,
then update `plugins.updater.pubkey` in `tauri.conf.json` and re-set the secret.

</details>

> 🔏 **Code signing** (the Authenticode certificate that removes the SmartScreen
> warning) is separate and still pending — it needs a paid cert.

## 🗺️ Roadmap

| Status | Item |
| ------ | ---- |
| ✅ | Audio core — enumerate + switch default device |
| ✅ | Device list, favorites & filtering |
| ✅ | Global hotkeys |
| ✅ | Mic mute + fullscreen-safe status overlay |
| ✅ | Switch notifications (toast / banner / sound) |
| ✅ | Tray quick-switch flyout & menu |
| ✅ | Full tabbed settings + start-with-Windows |
| ✅ | CLI parity |
| ✅ | Auto-switch on connect + live external-change sync |
| ✅ | Branding, icons & distribution workflow |
| ✅ | Auto-update (Tauri updater, signed, via GitHub Releases) |
| ⏳ | Code signing (Authenticode cert — removes the SmartScreen warning) |
| 🔮 | Per-app audio profiles *(experimental)* |

## 📄 License

[MIT](./LICENSE) © Gabriel Leocadio
