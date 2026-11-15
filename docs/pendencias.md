# Pendências

O que ficou aberto depois da 0.8.0 (2026-11-14). Item resolvido sai daqui no
mesmo PR que o resolve. A numeração de fases do `CHANGELOG.md` continua sendo a
fonte da verdade; as letras A a E abaixo são do plano de modernização visual,
que não entrou no CHANGELOG como fases.

## Plano de modernização visual

Feito: **A** (favoritos estáveis, 0.7.1), a parte do **C** que cobre o volume na
tela e o banner no estilo do Windows 11, a fonte Segoe UI Variable e a animação
de saída (0.8.0).

- **D, flyout e menu da bandeja mais próximos do nativo.** Feito: pílula de
  seleção, cabeçalhos de seção com o atalho, teclado e a largura do menu de
  clique direito (`MENU_WIDTH`, 320 px). Falta: o flyout de troca rápida tem 300
  px (`WIDTH` em `flyout.rs`) e ainda corta o nome de alguns aparelhos, como
  "Headset Wireless (Harmony WHG…"; e o botão de mutar o microfone virar item de
  menu Fluent.
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
- **Acrílico no flyout e no menu da bandeja**, feito e ligado por padrão (visto na
  tela pelo desenvolvedor). A janela vira o card e o DWM desenha canto e sombra;
  ver `janela-material.md`.

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
- **Menu de clique direito e troca rápida, depois do ajuste de altura:**
  - o menu deixou de "sambar" ao passar o mouse do primeiro ao último item (se
    ainda sambar, a janela ficou curta demais para o `useFlyoutSizing` cobrir: a
    medida certa precisa ser feita no aparelho);
  - os itens do menu não têm fundo próprio, só no hover e no foco;
  - setas, Home/End, Enter e Esc na troca rápida, com e sem o slider de volume;
  - o rodapé cabe nos 300 px, e os atalhos ao lado de "Saída", "Entrada" e do
    mutar não quebram a linha com atalhos longos;
  - a pílula do aparelho em uso, na lista e na troca rápida.
- **Acrílico no flyout e no menu da bandeja**, o que ainda vale conferir:
  - o vidro aparece e a janela tem o tamanho do conteúdo, sem faixa transparente
    em volta nem corte embaixo;
  - cantos arredondados e sombra do sistema, e a borda de 1 px do DWM;
  - o vidro continua ativo com a janela em foco (ela é `WS_EX_NOACTIVATE`: o DWM
    pode tratá-la como inativa e cair para cor sólida);
  - texto legível sobre papel de parede claro e escuro, e com o app em claro com
    o Windows em escuro (e o inverso);
  - fecha na hora, sem vidro vazio ficando para trás, e reabre sem piscar;
  - volume por slider dentro do flyout e a troca de dispositivo seguem funcionando;
  - desligar volta ao card sólido de antes, com a sombra e a animação;
  - sobre um jogo em tela cheia (borderless), que é o motivo de a janela existir.
- **Mica e Acrílico na janela principal**, a lista de conferência. A Mica é
  sutil e, com Wallpaper Engine, quase igual ao Sólido: teste com papel de parede
  estático e colorido (o Acrílico é o que se vê através):
  - o fundo aparece (e a janela não fica preta, branca ou invisível), em claro e
    escuro, nas quatro opções, trocando ao vivo;
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
