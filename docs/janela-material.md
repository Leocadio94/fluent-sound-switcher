# Materiais das janelas (Mica e Acrílico)

Configurações → Geral tem duas opções:

- **Material da janela** (só a janela principal): **Acrílico** (padrão), **Mica**,
  **Mica Alt** ou **Sólido**.
- **Acrílico nos menus flutuantes** (ligado por padrão): a troca rápida da
  bandeja e o menu de clique direito.

O padrão é o Acrílico nos dois. Onde o Windows não o desenha, o backend rebaixa
sozinho (ver `material::resolve`), então o padrão é seguro em qualquer versão.

O volume na tela, o banner e o indicador de mudo continuam sólidos.

## O que cada material faz

- **Mica** tinge o fundo com a cor do papel de parede, borrada e escurecida. É
  sutil e **nunca deixa ver o que está atrás da janela**. Com papel de parede
  escuro ou preto o resultado é quase igual ao Sólido. O Windows lê o papel de
  parede como imagem estática: com o Wallpaper Engine, o DWM vê o fallback (preto),
  e a Mica sai preta. Para ver a diferença, teste com um papel de parede estático
  e colorido.
- **Mica Alt** é a mesma ideia, mais escura e com mais contraste.
- **Acrílico** borra o que está atrás da janela, e esse sim se vê através. O
  Acrílico do sistema não tem tinta ajustável, então por cima dele fica uma
  camada do fundo do tema a 60% (`theme/acrylicTint.ts`, `ACRYLIC_TINT_PERCENT`),
  que mantém o blur e dá contraste ao texto sobre fundo claro. Vale para a janela
  principal em Acrílico e para os cards do flyout e do menu; a Mica não leva
  camada, porque já é discreta. É um número só: mais alto escurece e borra
  menos.
- **Sólido** é o fundo opaco de sempre.

## Janela principal

- A janela `main` é `transparent: true` em `tauri.conf.json`. Sem isso o fundo
  opaco da WebView2 cobre o backdrop.
- `set_window_material` (`material.rs`) aplica o efeito com
  `WebviewWindow::set_effects` e devolve o material **efetivo**. O frontend
  pinta transparente só quando o efetivo não é `solid`.
- `material::resolve` rebaixa o pedido quando o Windows não desenha: Mica Alt e
  Acrílico viram Mica antes da build 22621, e Mica vira sólido antes da 22000
  (Windows 10). É necessário porque a janela é transparente: um backdrop recusado
  deixaria a janela **invisível**, não só chapada. A build vem de `RtlGetVersion`;
  `GetVersionExW` mente para processo sem manifesto.
- O Acrílico só é oferecido a partir da build 22621. Nela o `window-vibrancy` usa
  o backdrop do sistema (`DWMSBT_TRANSIENTWINDOW`); antes disso ele cairia no
  Acrílico antigo (`SetWindowCompositionAttribute`), que engasga ao arrastar a
  janela.
- `set_effects` engole os erros do DWM, então o backend não tem como saber se o
  efeito pegou além da versão do Windows.
- Com os efeitos de transparência do Windows desligados o DWM pinta uma cor
  sólida no lugar do backdrop.
- O backdrop é aplicado no `bootstrap` (`main.tsx`), antes do primeiro render e
  com a janela ainda escondida, e tem prazo de 2 s: se o IPC travar, a janela
  aparece sólida em vez de nunca aparecer.

## Troca rápida e menu da bandeja (Acrílico)

O backdrop do DWM preenche o retângulo da janela e ignora o `border-radius` do
CSS. Por isso, com o Acrílico ligado, **a janela passa a ser o card**:

- o backend manda `flush: true` em cada `flyout-view`; a página tira a margem de
  8 px, a sombra, a borda e o fundo, e o tamanho que reporta deixa de somar os
  16 px da sombra (`Flyout.tsx`, `TrayMenu.tsx`);
- quem desenha cantos e sombra é o sistema: `set_shadow(true)` e
  `auxwin::round_corners` (`DWMWCP_ROUND`);
- `flyout::style_window` restyla a janela a cada abertura, mas só toca no DWM
  quando a resposta mudou;
- sem animação de entrada nem de saída: o backdrop não anda nem some junto com o
  conteúdo, e animar só o conteúdo deixaria um vidro vazio por 160 ms. `dismiss`
  esconde na hora quando o Acrílico está aplicado;
- o aviso de build vale aqui também: abaixo da 22621 o flyout segue sólido;
- sem folga, qualquer diferença entre a altura pedida e a obtida faz a página
  rolar sob o ponteiro (o menu "sambava" ao passar o mouse). Uma janela sem
  decoração com sombra tem deslocamentos de moldura escondidos, e o `tao` os soma
  ao tamanho na hora do pedido (`set_inner_size`). A causa exata não foi medida;
  `hooks/useFlyoutSizing.ts` mede o viewport depois de cada pedido e pede a
  diferença (até 48 px, 3 tentativas), o que cobre qualquer causa.

Dentro do card, na troca rápida: setas, Home/End, Enter e Esc (o primeiro
comando de seta é quem dá o foco, porque focar ao abrir desenharia um anel num
clique de mouse), rodapé com as teclas e o atalho global de cada ação ao lado do
cabeçalho e do botão de mutar (`hooks/useHotkeyHints.ts`, relido a cada abertura).

## Claro e escuro

O DWM escolhe a versão clara ou escura do material pelo tema **da janela**, não
pelo da página. Com o app em "claro" e o Windows em escuro, o backdrop sairia
escuro atrás de uma UI clara.

- Janela principal: `theme/windowChrome.ts` fixa o tema da janela na preferência
  do app (`setTheme`) e devolve o controle ao sistema em "Sistema".
- Flyout e menu: o backend faz o mesmo em `style_window`, lendo `theme` da
  config (`config::theme_preference`), porque a janela vive suspensa e só o
  backend sabe quando ela abre.

Efeito colateral bom: a barra de título do sistema também passa a seguir o tema
do app.

## O que ainda não foi visto renderizado

Compilado e testado (`material::resolve`), mas ninguém olhou o resultado do
Acrílico na tela. A lista de conferência está em `pendencias.md`.
