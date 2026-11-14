# Favoritos e IDs de endpoint

## O problema

Os favoritos são guardados pelo ID do endpoint de áudio (`IMMDevice::GetId()`,
algo como `{0.0.0.00000000}.{GUID}`). O Windows não mantém esse ID estável: o
mesmo aparelho volta com um ID novo depois de uma atualização de driver (os
endpoints HDMI/DisplayPort da NVIDIA são recriados), quando um dongle USB muda de
porta ou quando um aparelho Bluetooth é pareado de novo.

O ID antigo continua gravado em `config.json`, mas não aparece mais na lista.
Antes, um favorito sem aparelho simplesmente sumia da tela, e o aparelho novo
chegava sem estrela.

Medido numa instalação real: dos 25 favoritos de saída, 14 já não existiam no
registro do Windows, 1 estava `notpresent` e o resto era válido.

## Estados que um ID pode ter

`list_audio_devices` lista só `active`, `unplugged` e `disabled`. O comando
`resolve_audio_endpoints` faz a busca direta (`IMMDeviceEnumerator::GetDevice`) e
enxerga mais dois:

| Estado       | Significado                                         | Nome legível? |
| ------------ | --------------------------------------------------- | ------------- |
| `notpresent` | driver removido, a chave ainda está no registro     | sim           |
| `missing`    | o Windows já esqueceu o ID                          | não           |

## O que o app faz

`favorites` guarda também `names` (ID → nome amigável), gravado enquanto o
aparelho existe. É o único jeito de reconhecer um favorito depois que o ID morre,
porque um ID `missing` não devolve nome.

`reconcileFavorites` (`src/lib/reconcileFavorites.ts`) troca o ID de um favorito
pelo do aparelho que o substituiu. Só roda na janela principal; duas janelas
reconciliando escreveriam uma por cima da outra.

- **Só mexe no que o backend confirmou como perdido** (`notpresent` ou
  `missing`). Um favorito que sumiu de um instantâneo da lista durante a
  renegociação do Bluetooth resolve como `unplugged` e fica quieto.
- **Substituto**: o único aparelho da mesma direção, com o mesmo nome, que ainda
  não é favorito. Havendo ativo, só os ativos entram na conta. Com dois
  candidatos nada muda: trocar pelo errado é pior que não trocar.
- **O nome é comparado sem o prefixo de porta USB.** Ao mudar de porta o Windows
  renomeia `Headset (CX31993)` para `Headset (3- CX31993)`
  (`comparableName`).
- **Vários favoritos órfãos com o mesmo nome** viram um só: são IDs velhos do
  mesmo aparelho.

O que não acha par aparece na lista principal como "Não encontrado", esmaecido,
com botão de remover (e "Remover todos" quando há mais de um). Nada é apagado
sozinho. No flyout continua oculto, porque lá só entram favoritos ativos.

## Outras proteções

- **Instância única** (`tauri-plugin-single-instance`). Cada processo mantém o
  arquivo inteiro em cache e o regrava a cada alteração; duas instâncias se
  sobrescreviam. A segunda só traz a janela da primeira para a frente, e nem
  isso quando é um `--autostart` repetido. Só nos builds de release: o
  `tauri dev` e o app instalado dividem o identifier e um tomaria o foco do
  outro.
- **Nada é gravado antes de os favoritos serem lidos.** Um clique na estrela
  nesse intervalo partia do estado vazio e apagava a outra direção. Se a
  primeira leitura falhou, a edição lê de novo em vez de ser descartada.
- **`missing` só vale para "o Windows não conhece esse ID"**
  (`ERROR_NOT_FOUND` ou `E_INVALIDARG`). Qualquer outra falha de COM vira
  `unplugged`, porque numa renegociação Bluetooth um aparelho que existe pode
  falhar a busca, e chamá-lo de perdido faria o favorito ser trocado por outro.
- **Uma leitura em voo não desfaz uma gravação**: cada escrita incrementa um
  contador de geração e a leitura mais velha é descartada.

## Alternativas descartadas

- **`PKEY_Device_ContainerId`**: não foi verificado se sobrevive à recriação do
  endpoint, e um ID `missing` não o devolve de qualquer forma.
- **Limpar órfãos sozinho depois de N dias**: apaga sem o usuário ver. Um
  favorito que some de verdade é o sintoma que este documento trata.
