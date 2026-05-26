---
title: Spotify Playlist Per Class — Design Spec
type: design
date: 2026-05-27
status: spec-locked-pending-implementation
related:
  - vault: strikedash_vault/Spotify-Playlist-Per-Class-Design.md
  - depends-on: docs/superpowers/specs/2026-05-25-whatsapp-bot-v1-design.md
---

# Spotify Playlist Per Class — Design Spec

Canonical spec. Vault pointer: `strikedash_vault/Spotify-Playlist-Per-Class-Design.md`.

## Resumo executivo

Cada aula em grupo da Strike recebe automaticamente uma playlist Spotify gerada por cron diário, semeada com 20 faixas aleatórias da playlist-mestre. Alunos inscritos podem pedir **1 música** via WhatsApp; o pedido entra no topo (FIFO) e empurra a base para baixo, garantindo que toca. Sistema rejeita pedidos sincronamente se o género do artista cair numa blocklist (pagode, funk carioca, axé, etc.). Cancelar reserva remove automaticamente a música. Sem moderação humana.

## Motivação

O Ricardo já tem uma playlist-mestre que o Marcelo toca nas aulas. A ideia é permitir que cada aluno inscrito numa aula contribua com **1 música pessoal** que será efectivamente tocada (não enterrada no fim da playlist). Isto cria envolvimento sem dar ao Marcelo trabalho extra de curadoria por aula.

## Princípios de design

1. **Música do aluno tem de tocar** — FIFO no topo: primeiro a pedir = primeiro a tocar (position 0).
2. **Marcelo não modera** — ele não vai ver setlists. Tudo automático.
3. **Inscrição obrigatória** — só quem reservou a aula pode contribuir. Evita trolling externo.
4. **Cancelar reserva = cancelar música** — anti-griefing (não dá para pôr "Baby Shark" e cancelar a aula).
5. **Filtro de género automático** — boxe quer rock/hip-hop/rap/pop. Pagode, funk carioca, axé etc. rejeitados na hora.

## Arquitectura

### Componentes

| Componente | Responsabilidade | Localização provável |
|---|---|---|
| `cron/daily-playlists` | Gera playlists das aulas do dia | `src/app/api/cron/playlists/route.ts` ou Vercel cron job |
| `spotify-client.ts` | Wrapper autenticado Spotify Web API + refresh token | `src/lib/spotify-client.ts` |
| `genre-filter.ts` | Resolve géneros via artist API + valida blocklist | `src/lib/genre-filter.ts` |
| `playlist-manager.ts` | Insert/remove/reorder + tracking de posições FIFO | `src/lib/playlist-manager.ts` |
| WA bot hook: pós-reserva | Oferta de pedido de música | enxerto no fluxo de reserva ([[WhatsApp-Bot-v1-Spec]] Slice 1) |
| WA bot hook: pós-cancel | Remove música ao cancelar reserva | enxerto no fluxo de cancel (Slice 2) |
| WA bot menu: `Outros > Playlist` | Listagem de aulas reservadas com link Spotify | novo handler |
| Admin UI: gestão blocklist | CRUD `WaBlockedGenre`, `WaBlockedArtist` | extensão do `/dashboard/wa` |

### Fluxo de dados

```
[Vercel Cron] → daily-playlists handler
    → Yogo API: listar aulas em grupo do dia
    → Spotify: create playlist (por aula)
    → Spotify: read master playlist
    → shuffle local, take 20
    → Spotify: add 20 tracks (positions 0..19)
    → DB: insert WaClassPlaylist

[WA Webhook] aluno confirma reserva
    → existing booking handler dispatches confirmation
    → NEW: post-booking song-offer hook → ask aluno por música

[WA Webhook] aluno envia link/nome
    → spotify-client: resolve track + artists
    → genre-filter: check blocklist (artist genres + specific artist IDs)
    → IF rejected → reply with reason, store WaSongRequest{status: rejected_*}
    → IF accepted → confirm with user → on "sim"
        → playlist-manager: insert at position = requestCount
        → DB: insert WaSongRequest{status: active, position}
        → DB: WaClassPlaylist.requestCount++
        → reply: "Adicionado"

[WA Webhook] aluno cancela reserva
    → existing cancel handler removes booking
    → NEW: post-cancel song-cleanup hook
        → find active WaSongRequest for (contactId, classId)
        → Spotify: DELETE from playlist
        → shift down positions of requests above (within request range)
        → DB: WaSongRequest.status = cancelled_by_unbook
```

## Comportamento detalhado

### Cron diário (madrugada)

Para cada **aula em grupo do dia**:

1. Cria playlist no Spotify. Nome: `"SH - {ClassName} {HH:MM} - {DD/MM}"`.
2. Busca **todas** as faixas da playlist-base (configurável via `SPOTIFY_BASE_PLAYLIST_ID`).
3. Shuffle local → pega 20 primeiras → adiciona à playlist da aula (positions 0..19).
4. Guarda `WaClassPlaylist { yogoClassId, spotifyPlaylistId, createdAt, requestCount: 0 }`.

**Aulas privadas (PT do Marcelo) não geram playlist.**

Schedule: Vercel cron job, `0 4 * * *` (Vercel crons correm em UTC — Portugal UTC+0/+1 → playlist gerada entre 04:00 e 05:00 local, em qualquer caso de madrugada). Idempotência: se já existe `WaClassPlaylist` para essa `yogoClassId`, skip. Shuffle não é determinístico entre runs, mas a idempotência garante 1 só selecção por aula por dia.

### Fluxo de pedido de música (pós-reserva)

```
Bot: Reserva ok para Muay Thai 19h ✅
     Queres pedir uma música para esta aula? Manda link Spotify ou nome.
     (ignora esta mensagem se não quiseres)

Aluno: https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv

Bot: [busca metadata + géneros do artista]
     [valida blocklist]
     Vais ouvir Bohemian Rhapsody — Queen 🎵
     Confirmar? (sim/não)

Aluno: sim

Bot: [adiciona em position = requestCount]
     [increment requestCount]
     [grava WaSongRequest{status: active}]
     Adicionado! 🥷
```

### Fluxo `Outros > Playlist`

Menu existente do bot → entrada nova `Playlist`:

```
Bot: As tuas próximas aulas:
     1. Hoje 19h — Muay Thai → {link Spotify}
     2. Amanhã 20h — BJJ → {link Spotify}

     (toca o link para abrir no Spotify)
```

Mostra apenas aulas **em grupo** que o aluno **reservou** nas próximas 24h.

### Pedido repetido (swap)

Se aluno já tem `WaSongRequest` activa para essa aula:

```
Bot: Já pediste "Bohemian Rhapsody — Queen" para esta aula.
     Queres trocar pela nova? (sim/não)
```

Sim → remove a antiga do Spotify + adiciona nova mantendo a mesma `position` (não passa para o fim da fila). Marca antiga como `status: swapped`. Não → cancela operação.

### Cancelamento de reserva

Hook no fluxo de cancel existente:

1. Encontra `WaSongRequest` activa para (`contactId`, `yogoClassId`).
2. Remove faixa do Spotify (`DELETE /playlists/{id}/tracks`).
3. Re-comprime posições no DB: para todas as `WaSongRequest{status: active, position > removida.position, yogoClassId: ...}`, `position -= 1`. **Spotify auto-compacta posições no DELETE** — não é preciso `PUT` extra, apenas garantir que o DB fica em sincronia com o estado pós-delete.
4. Marca `WaSongRequest.status = cancelled_by_unbook`.
5. `WaClassPlaylist.requestCount -= 1`.

### Janela temporal

Pedidos aceites **até 10 minutos APÓS o início da aula**. Depois disso `WaClassPlaylist.locked = true` (set por cron de 5-em-5min ou check on-demand). Pedidos depois disso ficam `status: rejected_window` com mensagem: *"Esta aula já começou há mais de 10 min — pedidos fechados."*

## Censura de género

### Quando

**Sincronamente, no momento do pedido.** Aluno cola link → bot resolve géneros → rejeita ou aceita. Feedback imediato:

> *"Esta música é classificada como **funk carioca** pelo Spotify. A casa só toca rock, hip-hop, rap e pop. Tenta outra 🥷"*

Custo: ~300ms (2-4 calls extra à API Spotify por pedido).

### Por que síncrono e não pré-aula / não review humana

| Momento | Problema |
|---|---|
| Pré-aula (cron) | Aluno espera ouvir, não ouve, fica chateado depois |
| Review manual Marcelo | Trabalho que ele não quer |
| Silent shadow-ban | Engano. Pior UX. |
| **Síncrono no pedido** | Feedback imediato, aluno aprende, tenta outra, zero trabalho humano |

### Como (mecânica Spotify)

1. `GET /tracks/{id}` → lê `artists[]`
2. Para cada `artistId`: `GET /artists/{id}` → lê `genres: string[]`
3. Se **qualquer** género de **qualquer** artista bate na blocklist (substring match case-insensitive) → rejeita
4. Adicionalmente valida `artistId` contra `WaBlockedArtist`

### Blocklist inicial (seed na primeira migration)

```
funk carioca, funk ostentação, funk mtg, funk 150,
funk melody, brega funk, funk consciente,
pagode, samba pagode,
axé, axe music,
forró eletrônico, forro eletronico, forró pé de serra,
sertanejo universitário, sertanejo romântico, modão,
pisadinha, brega,
pimba, kizomba, tarraxinha, fado, morna,
bossa nova, smooth jazz,
lullaby, children's music, kids music,
meditation, sleep, ambient sleep,
karaoke, worship, christian worship
```

**Géneros pretendidos (informativo, não enforced):** rock, hip-hop, rap, pop, electronic, metal, punk, drum and bass, trap, drill, EDM.

**Importante:** é **blocklist** (permissivo) não **whitelist** (restritivo). Géneros não listados passam — evita falsos negativos em artistas com tags raras ou novas.

### Auto-blacklist crescente

- `WaBlockedGenre { id, keyword, addedBy, addedAt, active }` editável via admin dashboard.
- `WaBlockedArtist { spotifyArtistId, artistName, reason, addedBy, addedAt }` para casos onde géneros estão "limpos" mas o artista é problema.
- Cada rejeição grava `WaSongRequest{ status: rejected_genre, rejectedReason: "funk carioca" }` — admin vê tentativas + itera blocklist com base em dados reais.

## Modelo de dados (Prisma)

```prisma
model WaClassPlaylist {
  id                String   @id @default(cuid())
  yogoClassId       Int      @unique
  spotifyPlaylistId String
  createdAt         DateTime @default(now())
  requestCount      Int      @default(0)
  locked            Boolean  @default(false)
}

model WaSongRequest {
  id                String   @id @default(cuid())
  contactId         String
  yogoClassId       Int
  spotifyTrackId    String
  spotifyTrackName  String
  spotifyArtistName String
  position          Int
  status            String
  rejectedReason    String?
  createdAt         DateTime @default(now())

  @@index([contactId, yogoClassId])
  @@index([yogoClassId, status])
}

model WaBlockedGenre {
  id        String   @id @default(cuid())
  keyword   String   @unique
  addedBy   String
  addedAt   DateTime @default(now())
  active    Boolean  @default(true)
}

model WaBlockedArtist {
  spotifyArtistId String   @id
  artistName      String
  reason          String?
  addedBy         String
  addedAt         DateTime @default(now())
}
```

`WaSongRequest.status` values: `active`, `cancelled_by_unbook`, `swapped`, `rejected_genre`, `rejected_artist`, `rejected_window`.

## Integração Spotify

### Auth

- **OAuth 2.0 Authorization Code flow**, uma única vez na conta do Ricardo.
- Scopes: `playlist-modify-public`, `playlist-modify-private`.
- `refresh_token` guardado em DB encriptado (campo dedicado em tabela `WaIntegrationToken` ou similar — definir no plan).
- Bot renova `access_token` quando expira (~1h). Cache em memória do worker.
- Endpoint one-time admin `/dashboard/wa/spotify-auth` faz o flow e guarda tokens.

### Endpoints Spotify usados

| Endpoint | Uso |
|---|---|
| `POST /users/{userId}/playlists` | Cria playlist da aula (cron diário) |
| `GET /playlists/{id}/tracks` | Lê playlist-mestre (paginado) |
| `POST /playlists/{id}/tracks` (com `position`) | Insere música na posição FIFO |
| `DELETE /playlists/{id}/tracks` | Remove ao cancelar reserva |
| `PUT /playlists/{id}/tracks` | Reorder em casos específicos (não usado em delete — Spotify auto-compacta) |
| `GET /tracks/{id}` | Resolve metadata do link/ID |
| `GET /artists/{id}` (batch via `GET /artists?ids=...`) | Lê `genres[]` para blocklist |
| `GET /search?type=track` | Fallback se aluno mandar texto em vez de link |

### Caveat de deprecação

Spotify deprecou em Nov/2024: `audio-features`, `audio-analysis`, `recommendations`, `related-artists`, `featured-playlists`, `category-playlists`, preview URLs. **Nada disto é usado aqui.** O endpoint `/artists/{id}` com `genres` continua activo — validar antes de implementar.

## Tratamento de erros

| Erro | Tratamento |
|---|---|
| Spotify API rate limit (429) | Backoff exponencial até 3 tentativas; on fail, reply "Sistema ocupado, tenta daqui a pouco" |
| Spotify API 5xx | Log + reply "Erro temporário, tenta novamente" |
| Refresh token inválido / revogado | Log crítico + admin alert; bot responde "Sistema de música offline, contacta o admin" |
| Link Spotify inválido / não-track | "Não reconheci este link Spotify. Manda o link de uma música." |
| Track não encontrada (`/tracks/{id}` 404) | "Música não encontrada no Spotify" |
| Aluno tenta pedir música sem reserva activa | "Não tens reserva activa em aulas em grupo nas próximas 24h. Reserva uma primeiro." |
| Aluno tenta pedir música para PT | "Aulas privadas não suportam pedidos de música." |
| Cron de geração falha numa aula específica | Log + retry no próximo cron; admin alert se falha 2x consecutivas |
| Playlist Spotify apagada manualmente | Detect on first API call → invalidate `WaClassPlaylist`, criar nova on-demand |

## Estratégia de testes

- **Unit:** `genre-filter` (blocklist matching, edge cases — case insensitivity, substrings, multi-genre artists), `playlist-manager` (FIFO insert positions, position recompression após delete).
- **Integration:** Spotify client com mock server (`msw` ou similar) — verificar flow OAuth refresh, retry de 429, tratamento de 4xx vs 5xx.
- **End-to-end (manual, dev):** fluxo completo num grupo WA de teste — reserva, pedir, swap, cancelar, validar Spotify playlist tem o esperado.
- **Backfill seed:** script para popular `WaBlockedGenre` com keywords iniciais (Prisma seed).

## Métricas de sucesso (pós-launch)

- ≥30% dos alunos inscritos pedem música na primeira semana
- ≥80% dos pedidos são aceites (taxa de rejeição por género abaixo de 20% indica blocklist bem calibrada)
- 0 incidentes de música indevida tocada em aula durante 1 mês
- Crescimento orgânico da blocklist via admin: máximo 5 keywords novas/mês após mês 1

## Decisões fechadas (não rediscutir sem motivo forte)

- 1 música por aluno por aula
- Apenas aulas em grupo (PTs excluídas)
- FIFO (1º a pedir = 1º a tocar = position 0)
- 20 músicas-base por aula (shuffle aleatório da playlist-mestre)
- Censura síncrona no momento do pedido
- Blocklist (não whitelist) de géneros
- Cancela reserva → cancela música automaticamente
- Janela: até 10min após início da aula
- Playlist-mestre via env var (`SPOTIFY_BASE_PLAYLIST_ID`), não admin UI inicialmente

## Open / dependente de validação durante implementação

- **Confirmar Spotify Free permite a Marcelo tocar via playlist** — criar playlist é Free; reprodução depende do método. Se Marcelo abre manualmente no telemóvel e dá play, Free chega. Validar antes do launch.
- **Como identificar "aula em grupo" vs PT na resposta Yogo** — o bot v1 já faz esta distinção; reutilizar mesma lógica.
- **Encriptação do refresh token** — usar `node:crypto` AES-GCM com chave em env var, ou Vault/KMS. Decidir no plan.
- **Locking concurrency** — se dois alunos pedirem música simultaneamente, race condition no `requestCount`. Usar Prisma transaction + row lock (Turso/SQLite: BEGIN IMMEDIATE) ou increment atómico.

## Slicing proposto (input para writing-plans)

1. **Slice A — Spotify auth + client wrapper.** OAuth one-time endpoint + token storage + refresh logic + thin client. Ship sem WA integration.
2. **Slice B — Daily cron.** Cron diário gera playlists das aulas do dia (sem requests ainda). Validar shuffle, naming, idempotência.
3. **Slice C — Genre filter.** Blocklist tables + seed + filter function + admin endpoints CRUD. Sem UI ainda (admin via curl/SQL ok no início).
4. **Slice D — WA pedido + add.** Hook pós-reserva, parser link, confirm flow, FIFO insert. Sem cancel ainda.
5. **Slice E — WA cancel + swap.** Hook pós-cancel removes music, swap flow, position recompression.
6. **Slice F — WA discovery menu.** `Outros > Playlist` listing.
7. **Slice G — Admin UI blocklist.** `/dashboard/wa/blocklist` CRUD para género e artista.

Cada slice deve ser shippable independente; Slices A+B podem ir a produção sem D+E (gera playlists, ninguém pede ainda — playlists são úteis na mesma para o Marcelo tocar).

## Related

- [[WhatsApp-Bot-v1-Spec]] — bot base onde isto se enxerta
- [[WhatsApp-Bot-Pending]] — anexar como growth follow-up
- [[Yogo-API]] — fonte da agenda de aulas
- [[Roadmap]] — encaixar como Sprint 5
