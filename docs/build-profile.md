# Perfil de build e espaço em disco

O `target/` do Rust chegava a ~20 GB entre um `cargo sweep` e outro. Dois
ajustes no `src-tauri/Cargo.toml` cortam a maior parte disso.

## Medição

Build de dev a partir de um `target/` limpo (`cargo build`), em 2026-11-04:

| | Antes | Depois |
|---|---|---|
| Tamanho do `target/` | 6,82 GB | 2,15 GB |
| Tempo do build limpo | 2m46s | 1m27s |
| `fluent_sound_switcher_lib.lib` | 1,15 GB | não é mais gerado |
| `libfluent_sound_switcher_lib.rlib` | 433 MB | 69 MB |
| `fluent_sound_switcher.pdb` | 189 MB | 37 MB |

O rebuild incremental depois de editar um arquivo do app leva ~4 s. Os 20 GB
vinham do acúmulo: dev, release, `cargo test` e `clippy` repetindo esses
artefatos a cada rodada.

## `crate-type = ["rlib"]`

O template do Tauri v2 declara `["staticlib", "cdylib", "rlib"]`. `staticlib`
e `cdylib` só servem para iOS e Android, que embutem o app como biblioteca
nativa. No Windows eles fazem o crate ser linkado três vezes. Só o `staticlib`
gerava um `.lib` de 1,15 GB, regravado a cada build.

O `main.rs` chama `fluent_sound_switcher_lib::run()` pela `rlib`, então o
desktop não perde nada. Se um dia houver build mobile, os dois tipos voltam.

## `[profile.dev]`

```toml
[profile.dev]
debug = "line-tables-only"

[profile.dev.package."*"]
debug = false
```

- **O crate do app** mantém só as tabelas de linha. Backtraces e panics
  continuam apontando arquivo e linha. O que se perde são as variáveis locais
  num debugger, que este projeto não usa: o diagnóstico é pelo log (ver
  `CLAUDE.md`, "Logging").
- **As dependências** ficam sem debuginfo. Elas eram a maior parte dos PDBs, e
  um backtrace que passa por elas ainda mostra os nomes das funções.

Para depurar com variáveis locais, sobrescreva sem editar o arquivo:
`CARGO_PROFILE_DEV_DEBUG=true cargo build`.

O `[profile.release]` não mudou. LTO e `codegen-units = 1` deixam o
`tauri build` lento, mas são o que mantém o instalador pequeno.

## Na máquina, fora do repo

- **`CARGO_TARGET_DIR` compartilhado** entre projetos Tauri (por exemplo
  `ponto-app`) faz `tauri`, `windows` e `tokio` serem compilados uma vez só,
  e não uma por projeto. O custo: dois projetos não compilam em paralelo,
  porque o Cargo trava o diretório.
- O `cargo sweep` agendado continua útil para os artefatos de toolchains
  antigas.
