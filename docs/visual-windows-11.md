# Linguagem visual das janelas pequenas

Vale para o volume na tela, o indicador de mudo e o banner de troca de
dispositivo. O que o app tinha parecia Fluent, mas genérico; a referência agora
é o que o Windows 11 desenha.

## Superfície

- **Fundo opaco** (`colorNeutralBackground1`), borda de 1 px
  (`colorNeutralStroke2`), canto de 8 px (`borderRadiusXLarge`). É o flyout do
  Windows 11.
- **Sem `backdrop-filter`.** A janela é transparente, então não há nada atrás do
  card para desfocar, e um fundo translúcido só ficava turvo sobre um jogo.
- **Acrylic de verdade ficou de fora por enquanto.** O Acrylic do DWM preenche o
  retângulo da janela inteira e não segue o `border-radius` do CSS. Para ter
  cantos arredondados a janela teria de ter exatamente o tamanho do card, com o
  arredondamento do próprio DWM, e isso se ajusta olhando no aparelho.

## Tipografia

Segoe UI Variable Text, a fonte do resto do shell (`theme/windowsFont.ts`). O
Fluent web pede a Segoe UI estática, que é a do Windows 10, com o `Segoe UI`
como reserva em sistemas antigos.

O banner usa a hierarquia de uma notificação do Windows: nome do aparelho em
14 px semibold e, embaixo, a legenda em 12 px, em frase normal. O rótulo em
caixa alta de 10 px foi removido.

## Volume na tela

A barra usa os tokens do `Slider` do Fluent: trilho `colorNeutralStrokeAccessible`
e preenchimento `colorCompoundBrandBackground`. Mudo atenua a barra inteira em
vez de trocar a cor, porque qualquer cinza fixo fica perto do trilho em um dos
dois temas.

O card ocupa a janela de 260 px (`VOLUME_WIDTH` em `overlay.rs`) menos 24 px de
folga para a sombra. O trilho é um filho flex sem conteúdo: num pill que se
ajusta ao conteúdo ele ficava com largura zero e a barra nunca aparecia.

## Banner

Cada banner remonta o card (`key` = `id` do payload) para repetir a animação de
entrada. O `id` é a geração do backend: as reemissões de segurança de 80, 200 e
400 ms do mesmo banner carregam o mesmo `id` e não reiniciam a animação.
