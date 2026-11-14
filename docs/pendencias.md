# Pendências

O que ficou aberto depois da 0.8.0 (2026-11-14). Item resolvido sai daqui no
mesmo PR que o resolve. A numeração de fases do `CHANGELOG.md` continua sendo a
fonte da verdade; as letras A a E abaixo são do plano de modernização visual,
que não entrou no CHANGELOG como fases.

## Plano de modernização visual

Feito: **A** (favoritos estáveis, 0.7.1), a parte do **C** que cobre o volume na
tela e o banner no estilo do Windows 11, a fonte Segoe UI Variable e a animação
de saída (0.8.0).

- **D, flyout e menu da bandeja mais próximos do nativo.** O flyout de troca
  rápida tem 300 px e corta o nome de alguns aparelhos: precisa de mais largura
  (`WIDTH` em `flyout.rs`; o menu de clique direito tem `MENU_WIDTH` próprio e
  pode pedir o mesmo). Junto: pílula de seleção à esquerda no lugar do check,
  tipografia e cabeçalhos de seção como no painel de som do Windows, e o botão
  de mutar o microfone virando item de menu Fluent.
- **B, contraste do accent.** Hoje o Fluent web usa `brand[100]`/`brand[70]` e um
  accent escuro perde contraste (ícone e texto). Mapear como o WinUI (escuro:
  Light2 no preenchimento e Light3 no texto; claro: Dark1 e Dark2), com uma guarda
  `pickReadable` de 3:1 para ícone e 4,5:1 para texto, e testes. A nota "stop 80
  fixo" do `CLAUDE.md` deixa de valer quando isso entrar.
- **E, janela principal.** A Mica já entrou (`janela-material.md`). Falta: cards
  (`colorNeutralCardBackground`) por seção da lista, pílula de seleção no
  `DeviceRow`, ações que aparecem no hover e `Collapse` animado no painel de
  volume. Os cards de dispositivo seguem opacos (`colorNeutralBackground1`) sobre
  a Mica; ver se leem bem antes de trocar o token.
- **Acrylic nas janelas flutuantes**, adiado. O efeito do Tauri não segue o
  `border-radius` do CSS numa janela transparente; só funcionaria com a janela do
  tamanho exato do card e o arredondamento do DWM. Reavaliar se valer o custo.

## Distribuição

- Assinatura de código (certificado Authenticode), que tira o aviso do SmartScreen.
- winget e depois Scoop. A Microsoft Store assina o MSIX de graça.
- Perfis por aplicativo (Fase 9, experimental, adiada).

## Para você testar à mão

Nada disto foi visto renderizado por quem escreveu o código.

- **Favorito do dongle USB** trocando de porta: a reconciliação por nome foi
  testada com a lista, não com o dongle.
- **"Iniciar com o Windows"**: a primeira atualização para a 0.8.0 ainda reseta a
  opção, porque a restauração só existe a partir dela. Ligue de novo e confira se
  sobrevive à próxima atualização.
- **Segurar o atalho de volume**: os tempos são palpite (`HOLD_DELAY` 400 ms,
  `HOLD_INTERVAL` 70 ms, `HOLD_MAX` 20 s em `hotkeys.rs`). Ajustar se parecer
  lento ou rápido.
- **Animação de saída** do banner, do volume e do flyout, e a entrada do flyout
  na primeira abertura depois de iniciar o app, que pode não animar.
- **Atualizador com o plugin de instância única**: o relançamento depois de
  atualizar não foi testado.
- **Mica na janela principal**, a lista de conferência:
  - o fundo aparece (e a janela não fica preta, branca ou invisível), em claro e
    escuro, nas três opções, trocando ao vivo;
  - com o app em "claro" e o Windows em escuro (e o inverso), a Mica acompanha o
    app, inclusive ao trocar a preferência com a janela aberta;
  - voltar para "Sistema" depois de fixar claro ou escuro: o `setTheme(null)` da
    janela tem de devolver o `prefers-color-scheme` ao do Windows, senão o tema
    "Sistema" do app não volta a seguir o sistema;
  - com Sólido ou no Windows 10 a janela é `transparent` do mesmo jeito: conferir
    sombra e cantos, que podem mudar em relação à 0.8.0;
  - "Efeitos de transparência" desligado no Windows: deve virar cor sólida;
  - barra de título do sistema com Mica, e a troca custom ↔ sistema ao vivo;
  - os cantos arredondados e a sombra da janela, que agora é `transparent`;
  - abrir minimizado (`--autostart`) e depois pelo tray, sem piscar chapado;
  - arrastar e redimensionar sem travar.
- **Favoritos sem nome recuperável**: 14 IDs antigos do `config.json` do
  desenvolvedor não têm como virar nome; aparecem como "Não encontrado" para
  remover.

## Landing

A reformulação da landing no estilo Fluent mora no portfólio
(`docs/landing-fluent-sound-switcher-fluent.md`). Começa pelo passo 0, escolher as
skills de apoio. Dependem de captura no Windows, com um jogo aberto: o OSD de
volume e o banner novos, e o menu de clique direito da bandeja, em claro e escuro.
