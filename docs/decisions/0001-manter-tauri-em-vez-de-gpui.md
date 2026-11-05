# 0001 — Manter Tauri em vez de migrar para GPUI

- **Status:** aceita
- **Data:** 2026-11-04

## Contexto

O [GPUI](https://gpui.rs/), o framework de UI do Zed, desenha tudo nativo em
Rust, sem WebView. Avaliamos trocar o Tauri por ele, já que o backend inteiro
já é Rust. Havia duas motivações:

- o build lento (o inicial e o `pnpm tauri:dev`);
- o `target/` passando de ~20 GB, mesmo com `cargo sweep` agendado.

Na época o frontend tinha ~5 mil linhas de TS/TSX em 22 componentes, apoiado
no Fluent UI React v9 (Button, Switch, Dropdown, Tooltip, MessageBar, TabList,
Dialog, Menu, Slider).

## Decisão

Ficamos no Tauri. O problema de build e disco foi tratado na configuração do
Cargo. Ver [build-profile.md](../build-profile.md).

## Por quê

**O GPUI não resolve a queixa que motivou a avaliação.** O peso está no
`target/` do Rust: debuginfo, PDBs do Windows e cache incremental. O Vite do
front é rápido e ocupa pouco. O GPUI é uma dependência Rust pesada, com
renderizador DirectX, shaping de fonte e layout próprios. O build e o disco
ficariam iguais ou piores.

**O custo da migração é alto e cai justamente no diferencial do app:**

- O Fluent 2 não existe no GPUI. Cada componente teria que ser redesenhado à
  mão: tokens, estados de foco, animações, navegação por teclado. O
  `gpui-component` segue um visual estilo shadcn, não Windows 11.
- A acessibilidade hoje vem pronta: o WebView2 expõe ARIA para o UI
  Automation. No GPUI o suporte a leitor de tela era fraco.
- Os plugins teriam substitutos avulsos:
  - tray: `tray-icon`
  - global-shortcut: `global-hotkey`
  - notification, autostart, store e log
- O bundler MSI/NSIS teria que ser montado à mão.
- O updater é o ponto mais arriscado. Não há equivalente direto, e a migração
  exigiria uma release de transição entregue pelo updater atual para todas as
  cópias instaladas.
- O GPUI é pré-1.0, com API instável, pouca documentação e suporte a Windows
  recente. Na prática, acompanha-se o repositório do Zed.

## O que o GPUI teria de melhor

- **Memória e startup.** O app mantém várias instâncias de WebView2 vivas
  (main, overlay, flyout, banner). Um app nativo usaria bem menos RAM.
- **Fim das armadilhas próprias do WebView2:**
  - o renderer que volta invisível depois do sleep (`power.rs`);
  - a drag region virando janela (`DRAG_BAR_WINDOW_CLASS`);
  - o snap layouts bloqueado pelas janelas filhas do WRY;
  - o `color-scheme` forçado;
  - a altura errada do `MessageBar`.

  Todas já estavam contornadas.

O que é Win32 puro continuaria igual, em cima do HWND do GPUI: topmost acima
de jogos em tela cheia, click-through, Win+D e `SetWindowPos`.

## Quando reavaliar

- se o consumo de RAM virar reclamação real de usuário;
- quando o GPUI chegar à 1.0 com acessibilidade no Windows e houver uma
  biblioteca de componentes com cara de Fluent.

## Consequências

- O app continua dependente do WebView2 e das armadilhas listadas no
  `CLAUDE.md`.
- O tempo e o espaço de build passam a ser tratados pela configuração do Cargo.
