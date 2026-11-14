# Material da janela principal (Mica)

A janela principal pode ter o fundo translúcido do Windows 11. A escolha fica em
Configurações → Geral → "Material da janela": **Mica** (padrão), **Mica Alt** ou
**Sólido**. Vale só para a janela principal.

## Por que só ela

Mica pega a cor do papel de parede, não do que está atrás da janela, e foi feita
para janelas que ficam abertas. Nenhum popup do Windows a usa. As janelas
flutuantes (volume na tela, banner, indicador de mudo, flyout e menu da bandeja)
continuam sólidas:

- as três primeiras são `WS_EX_NOACTIVATE`, nunca ficam ativas, e o backdrop do
  sistema volta para a cor sólida em janela inativa;
- o backdrop do DWM preenche o retângulo da janela e ignora o `border-radius` do
  CSS, então um card com canto arredondado dentro de uma janela maior ficaria com
  um retângulo de vidro em volta (ver `visual-windows-11.md`).

O Acrylic no flyout e no menu continua em aberto, em `pendencias.md`. O "Blur"
antigo do Windows 10 não entra: sem a camada de cor o contraste é ruim.

## Como funciona

- A janela `main` é `transparent: true` em `tauri.conf.json`. Sem isso o fundo
  opaco da WebView2 cobre o backdrop.
- `set_window_material` (`material.rs`) aplica o efeito com
  `WebviewWindow::set_effects` e devolve o material **efetivo**. O frontend
  pinta transparente só quando o efetivo não é `solid`.
- `material::resolve` rebaixa o pedido quando o Windows não desenha: Mica Alt
  vira Mica antes da build 22621, e Mica vira sólido antes da 22000 (Windows
  10). É necessário porque a janela é transparente: um backdrop recusado
  deixaria a janela **invisível**, não só chapada. A build vem de `RtlGetVersion`;
  `GetVersionExW` mente para processo sem manifesto.
- `set_effects` engole os erros do DWM, então o backend não tem como saber se o
  efeito pegou além da versão do Windows.
- Com os efeitos de transparência do Windows desligados o DWM pinta uma cor
  sólida no lugar do backdrop. Não precisa de tratamento no app.
- O backdrop é aplicado no `bootstrap` (`main.tsx`), antes do primeiro render e
  enquanto a janela ainda está escondida, para a janela nunca aparecer chapada
  e depois ganhar Mica. Por isso o backend não aplica nada no `setup()`.

## Claro e escuro

O DWM escolhe a Mica clara ou escura pelo tema **da janela**, não pelo da página.
Com o app em "claro" e o Windows em escuro, a Mica sairia escura atrás de uma UI
clara. `theme/windowChrome.ts` fixa o tema da janela na preferência do app
(`setTheme`, permissão `core:window:allow-set-theme`) e devolve o controle ao
sistema em "Sistema". Efeito colateral bom: a barra de título do sistema também
passa a seguir o tema do app.

## O que ainda não foi visto renderizado

Compilado e testado (`material::resolve`), mas ninguém olhou o resultado na tela.
A lista de conferência está em `pendencias.md`.
