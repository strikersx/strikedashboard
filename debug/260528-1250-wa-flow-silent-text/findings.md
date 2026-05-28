# WA song-request flow — silent failure + flow-ends-in-text bugs

## Symptom (from user)
1. Após enviar link Spotify → nenhuma resposta, música não adicionada
2. "Queres pedir uma música?" é texto, devia ser botões
3. Música devia ir para o TOPO da playlist (não fim)
4. Qualquer fluxo nunca pode terminar em texto solto

## Root cause 1 — Silent failure after Spotify link
**Local:** `src/lib/wa/handlers/song-request.ts:129`
```ts
const result = await evaluateTrack(trackId);  // ← throws on Spotify 403
```
`evaluateTrack` lança erro em `src/lib/spotify/genre-filter.ts:55` quando o Spotify devolve não-200 (`Track lookup failed: ${status}`). Em produção temos 403 conhecido (Development Mode — ver vault [[Spotify-API#Quota Modes — A causa do 403]]).

`handleSongInput` não tem try/catch à volta. O erro propaga até `dispatch()`, é apanhado pelo wrapper do webhook (`route.ts:90`) e gravado como `DISPATCH_FAIL` em `WaEvent` — **mas o utilizador não recebe NADA**.

Mesmo padrão silencioso em `handleSongConfirm:248` e `handleSwapConfirm:370` (segunda chamada a `evaluateTrack` no confirm path).

## Root cause 2 — Música vai para o fim, não topo
**Local:** `src/lib/spotify/playlist-manager.ts:110-122`
```ts
const playlist = await tx.waClassPlaylist.update({ data: { requestCount: { increment: 1 }}})
const position = playlist.requestCount - 1;  // ← 0, 1, 2, 3… (FIFO append)
```
Cada pedido vai para `requestCount-1`, ou seja FIFO. Para inserir sempre no topo é `position: 0` (Spotify empurra os existentes para baixo — confirmado no vault `Spotify-API.md §7.4`).

## Root cause 3 — Offer é texto livre
**Local:** `src/lib/wa/handlers/song-request.ts:15-16` e `:72`
```ts
const OFFER_TEXT = "Queres pedir uma música ... ou diz 'não' ...";
await sendText(phoneE164, OFFER_TEXT);
```
Devia ser `sendButton` com {Sim / Não / Menu}.

## Root cause 4 — Vários exit-points terminam em texto sem menu
Já existe `endInteraction()` em `src/lib/wa/handlers/menu.ts:22` que faz `resetToIdle + sendMenu`. Está chamado na maioria dos paths. Mas há buracos:
- `song-request.ts:217` (race no AWAIT_SONG_CONFIRM transition) — falta endInteraction
- `song-request.ts:238` ("Responde 'sim' ou 'não'") — fica no estado, ok
- `song-request.ts:270` (race no swap transition) — falta endInteraction
- `dispatch.ts:118-128` (hints "Manda o link...", "Responde sim/não") — texto, sem botões

## Fix plan
1. **song-request.ts:** wrap as duas chamadas `evaluateTrack` em try/catch, com mensagem ao user + endInteraction
2. **playlist-manager.ts insertSongAtNextPosition:** `position = 0` (sempre topo)
3. **render.ts:** novo `renderSongOffer()` retorna botão {sim_song / no_song / btn_voltar_menu}
4. **dispatch.ts:** mapear `sim_song` / `no_song` / `btn_voltar_menu` como entradas válidas em AWAIT_SONG_INPUT. Botão `btn_voltar_menu` em qualquer estado → endInteraction
5. **song-request.ts:** offerSongRequest usa sendButton, handleSongInput aceita button.id além de text
6. **dispatch.ts hints:** quando estado espera texto mas recebe button/list, enviar botão com {repetir / voltar ao menu} em vez de texto livre

## Out of scope
- Resolver o 403 do Spotify (é problema upstream de Quota Mode — vault Spotify-API.md §4). O fix aqui é não-silenciar o erro, não corrigi-lo.
