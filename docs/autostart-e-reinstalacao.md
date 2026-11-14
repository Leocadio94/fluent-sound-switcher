# "Iniciar com o Windows" e a reinstalação

## O problema

Instalar uma versão nova desligava "Iniciar com o Windows". A opção é uma entrada
em `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, e o instalador NSIS do
Tauri a apaga: ao instalar por cima de uma instalação existente ele chama o
desinstalador da versão antiga, e este remove a entrada a menos que receba
`/UPDATE` (`installer.nsi`, `If $UpdateMode <> 1` → `DeleteRegValue … Run`).
Rodar o `Setup.exe` na mão não passa essa flag.

O `StartupApproved` do Explorer, que guarda o liga/desliga do Gerenciador de
Tarefas, não é tocado, então sobra um resíduo sem entrada correspondente.

## O que o app faz

O estado do sistema sozinho não diz se o usuário queria a opção, então o app
guarda a preferência em `config.json` (`autostart`) e a confere ao abrir
(`useRestoreAutostart`, `autostartAction`):

| Preferência | Entrada no Windows | Ação                                  |
| ----------- | ------------------ | ------------------------------------- |
| ligada      | ausente            | registra de novo                      |
| ligada      | presente           | nada                                  |
| ausente ou desligada | presente  | grava como ligada (já estava ativa)   |
| ausente ou desligada | ausente   | nada                                  |

Desligar a opção no app grava a preferência desligada e remove a entrada, então
não volta sozinha. Desativar pelo Gerenciador de Tarefas só vira o
`StartupApproved` e deixa a entrada, então também é respeitado.

Não roda no `tauri dev`: ele compartilha o `config.json` com o app instalado, e
registrar a partir dali gravaria o executável de debug.

## Limites

- Quem já perdeu a opção precisa ligá-la uma vez depois de atualizar para a
  versão que traz isso; antes não havia preferência gravada.
- A restauração roda quando a janela principal carrega, o que acontece também
  com o app iniciado na bandeja. A entrada só volta depois de o app abrir uma
  vez após a reinstalação; se o usuário reiniciar o Windows antes disso, essa
  inicialização não acontece.

## Alternativa descartada

Um template NSIS próprio que preserve a entrada. Obrigaria a manter uma cópia do
script do Tauri e a acompanhá-lo a cada versão do bundler, para resolver algo
que o app resolve sozinho.
