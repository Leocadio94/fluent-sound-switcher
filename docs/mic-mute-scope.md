# Escopo do mudo do microfone

## O que o mudo faz

O mudo age no **endpoint** de captura (`IAudioEndpointVolume::SetMute`), não no
app. Qualquer app que capta daquele microfone fica em silêncio: Teams, Discord,
Zoom, Meet, Slack. É o mesmo mecanismo do antigo Video Conference Mute do
PowerToys, que também usava o mudo global de microfone do Windows.

Não existe mudo "dentro do Teams" que um terceiro consiga aplicar. O app segue
mostrando o microfone aberto, só que enviando silêncio.

## Mutar todos os microfones

`micMuteAllDevices` (Configurações → Mudo, desligado por padrão). Sem ele, só o
microfone padrão é mutado, e um app fixado em outro microfone continua captando.

- O novo estado é o inverso do estado do **padrão**, aplicado a todos os
  endpoints de captura ativos (`audio::set_all_mics_mute`). O padrão vai
  primeiro e a falha dele é a do toggle; os demais são best effort.
- Microfone que chega é posto no estado atual, mudo ou não
  (`mute::sync_arrived_mic`, chamado de `events::on_arrival`). O toggle só
  alcança endpoints ativos, e o Windows guarda o mudo por endpoint: um
  microfone desplugado voltaria com o estado de antes, nos dois sentidos.
- O CLI (`mute`) lê a mesma chave direto do arquivo da config.

## Mudo de chamada do Windows (Win+Alt+K)

`micMuteCallShortcut` (desligado por padrão). Depois do mudo, envia Win+Alt+K
com `SendInput` (`callmute.rs`). No Windows 11 esse atalho aciona o mudo de
chamada da taskbar, que o Teams acompanha.

- É um **alternador** e o estado não pode ser lido. Se o usuário mutar pelo
  botão do próprio app, o mudo do Windows e o nosso ficam invertidos.
- Só funciona em apps que integram o recurso. Na prática, o Teams.
- O atalho do usuário costuma ainda estar pressionado quando o toggle roda. O
  envio espera Ctrl/Shift/Alt/Win serem soltos (até 600 ms) e desiste, com um
  aviso no log, se não forem. Sem isso o Windows veria outro atalho.
- Uma janela em primeiro plano elevada descarta a entrada de um processo sem
  elevação (UIPI). O log registra quantos eventos foram aceitos.

## Alternativas descartadas

- **Mudo por app** (`IAudioSessionManager2`, `ISimpleAudioVolume::SetMute` nas
  sessões de captura): é a Fase 9. Precisa de um spike antes, para confirmar
  que apps WebRTC (Discord, Chrome/Meet) respeitam o mudo de sessão de captura.
- **Câmera:** fora do escopo do app.
