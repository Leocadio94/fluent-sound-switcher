# AGENTS.md

Instructions for AI coding agents (Codex, Cursor, Copilot, Claude Code, …)
working in this repository.

## Read this first

The full, authoritative guidance lives in **[CLAUDE.md](./CLAUDE.md)**. It is not
Claude-specific — it documents the stack, the layout, the Windows/COM gotchas and
the working style for this project. Read it before making any change.

Additional context:

- [README.md](./README.md) — what the app is, how to install and run it.
- [CHANGELOG.md](./CHANGELOG.md) — the phase numbering is the source of truth for
  project status.

## Quick reference

```bash
pnpm install        # install JS deps
pnpm tauri:dev      # run the app (vite + rust)
pnpm tauri:build    # production bundle (msi + nsis)
pnpm lint           # tsc --noEmit (frontend typecheck)
cargo check --manifest-path src-tauri/Cargo.toml   # backend check
```

Before finishing a change, run `pnpm lint` and `cargo check`.

## Ground rules

- Windows-only app (Tauri v2 + React 19 + Fluent UI v9). Don't add cross-platform
  abstractions that aren't needed.
- Keep the Core Audio COM code inside `src-tauri/src/audio/`.
- Every user-facing string goes through `react-i18next` — add the key to **both**
  `src/i18n/locales/pt-BR.json` and `src/i18n/locales/en.json`.
- Work in phases: one phase per iteration, update `CHANGELOG.md` and keep
  `CLAUDE.md` current.
