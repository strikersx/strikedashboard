---
title: Spotify Web API — Reference para Strike's House
type: reference
date: 2026-05-27
source: https://developer.spotify.com/documentation/web-api
status: canonical
---

# Spotify Web API — Reference

Dissection completa da Spotify Web API focada no que o dashboard usa hoje
(playlist-per-class, song requests via WhatsApp) e no que precisamos
saber para diagnosticar o **bug 403 actual em Development Mode**.

> **Contexto do bug**: Em produção, `POST /v1/playlists/{id}/tracks` e
> `GET /v1/playlists/{id}/tracks` retornam **403 Forbidden** mesmo com
> token válido e scopes correctos. A causa é Development Mode (ver
> [[#Quota Modes — A causa do 403]]).

---

## 1. Base URLs

| Domain | Uso |
|---|---|
| `https://accounts.spotify.com` | OAuth (`/authorize`, `/api/token`) |
| `https://api.spotify.com` | Web API (todos os endpoints `/v1/...`) |

URI scheme para recursos:

- `spotify:track:{id}`
- `spotify:playlist:{id}`
- `spotify:user:{id}`
- `spotify:artist:{id}`

A maioria dos endpoints aceita o **ID** (não o URI) no path: `/v1/playlists/{playlist_id}/tracks` — `playlist_id` é só a parte final do URI.

---

## 2. Autenticação — Authorization Code Flow

É a flow que usamos. Server-side, refresh token rotativo, scope explícito,
admin autoriza uma única vez.

### Step 1 — Redirect para `/authorize`

```
GET https://accounts.spotify.com/authorize?
  client_id={CLIENT_ID}&
  response_type=code&
  redirect_uri={REDIRECT_URI}&
  scope=user-read-private%20user-read-email%20playlist-modify-public%20...&
  state={CSRF_NONCE}&
  show_dialog=true
```

- `redirect_uri` tem de bater **exactamente** com um URI registado no Spotify Developer Dashboard (case-sensitive, incluindo trailing slash).
- `state` é um nonce CSRF; valida na callback contra cookie httpOnly.
- `show_dialog=true` força re-aprovação (útil para mudar scopes).

Implementação: `src/app/api/spotify/login/route.ts`.

### Step 2 — Callback recebe `code`

Spotify redirecciona para `{REDIRECT_URI}?code={CODE}&state={STATE}`.

- Em erro: `?error=access_denied&state={STATE}`.
- **Validar `state` antes de prosseguir** (proteger contra CSRF).

### Step 3 — Trocar `code` por tokens

```
POST https://accounts.spotify.com/api/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(CLIENT_ID:CLIENT_SECRET)}

grant_type=authorization_code
&code={CODE}
&redirect_uri={REDIRECT_URI}
```

Resposta 200:

```json
{
  "access_token": "BQ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "AQ...",
  "scope": "user-read-private user-read-email playlist-modify-public ..."
}
```

- **`expires_in`**: 3600s (1h). Renew com refresh token 60s antes para safety.
- **`refresh_token`**: pode durar indefinidamente, mas pode ser rotativo.

Implementação: `src/app/api/spotify/callback/route.ts`.

### Step 4 — Refresh token

```
POST https://accounts.spotify.com/api/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(CLIENT_ID:CLIENT_SECRET)}

grant_type=refresh_token
&refresh_token={REFRESH_TOKEN}
```

**Gotcha crítico**: a resposta **pode ou não** incluir um novo `refresh_token`.

> "A refresh token might not be included in each response. When a refresh token is not returned, continue using the existing token."

Implementação correcta:

```typescript
const data = await tokenRes.json();
const newAccessToken = data.access_token;
const newRefreshToken = data.refresh_token ?? currentRefreshToken;
```

> No código actual (`src/lib/spotify/client.ts:32-37`), o refresh response só extrai `access_token` e `expires_in` — não persiste o eventual novo `refresh_token`. Funciona porque a Spotify não rotaciona quase nunca, mas é uma bomba relógio.

---

## 3. Scopes — Mapa completo

Tabela das scopes que o Strike's House precisa (e algumas adjacentes para referência futura):

| Scope | Necessária para | Onde se usa hoje |
|---|---|---|
| `user-read-private` | `GET /me` (campo `country`, `product`) | OAuth callback (identificar conta) |
| `user-read-email` | `GET /me` (campo `email`) | OAuth callback |
| `playlist-modify-public` | Criar/editar playlists públicas | `createClassPlaylist`, song requests |
| `playlist-modify-private` | Criar/editar playlists privadas | (fallback caso `public=false`) |
| `playlist-read-private` | `GET /playlists/{id}/tracks` de playlists privadas | `fetchAllBaseTracks` (base playlist privada) |
| `playlist-read-collaborative` | Ler playlists colaborativas | Não usado, requested para safety |

### Scopes que NÃO usamos (mas que existem)

- **Player**: `user-read-playback-state`, `user-modify-playback-state`, `user-read-currently-playing` — controlar dispositivo.
- **Biblioteca**: `user-library-read`, `user-library-modify` — músicas salvas do utilizador.
- **Streaming**: `streaming` — Web Playback SDK (requer Premium).
- **Histórico**: `user-top-read`, `user-read-recently-played`, `user-read-playback-position`.
- **Follow**: `user-follow-modify`, `user-follow-read`.
- **Imagens**: `ugc-image-upload` — cover art de playlists custom.

**Regra prática**: pedir apenas as scopes necessárias. Adicionar scopes força re-autenticação (existing refresh tokens **não** ganham as scopes novas automaticamente).

---

## 4. Quota Modes — A causa do 403

**Esta é a secção mais importante para o bug actual.**

Cada app Spotify está num de dois modos:

### Development Mode (default ao criar app)

- **Limite de 25 utilizadores** (anteriormente 5, expandido em 2024) — só users **explicitamente adicionados à allowlist** no Developer Dashboard conseguem autenticar.
- **403 silencioso** para users fora da allowlist mesmo com token "válido".
- **Rate limits baixos**.
- **App owner precisa de Spotify Premium** para a app funcionar.
- Restrições adicionais documentadas vs não documentadas:
  - Algumas operações de leitura/escrita em playlists **podem retornar 403** mesmo para o app owner em certos contextos.
  - Endpoints de Audio Features / Audio Analysis / Recommendations / Related Artists foram **bloqueados em Development Mode desde Nov 2024** (apenas Extended Quota).
  - Categorias, novos releases, e featured playlists também restritos.

### Extended Quota Mode

- Utilizadores ilimitados, sem allowlist.
- Rate limits muito superiores.
- Acesso completo a todos os endpoints.

### Como aplicar para Extended Quota (Mai 2025+)

Requisitos endurecidos:

- Entidade legal registada (empresa).
- App **launched** (em produção, não beta).
- **250k+ MAUs** activos.
- Disponível nos mercados-chave Spotify.
- Viabilidade comercial demonstrável.
- Adesão completa aos Terms.

Review demora **até 6 semanas** via formulário com email corporativo.

> **Para Strike's House**: não vamos qualificar para Extended Quota nas próximas iterações. Estratégia: trabalhar dentro de Development Mode, adicionar a conta Spotify do Marcelo à allowlist do Developer Dashboard, e usar **uma única conta Spotify "casa"** como dono de todas as playlists.

### Diagnóstico — Confirmar Development Mode

1. Spotify Developer Dashboard → app → Settings → secção "User Management" lista a allowlist.
2. Banner "App is in development mode" no dashboard.
3. `GET /me` retorna `product` mas pode ser `"open"` mesmo para conta Premium em certas condições — sinal de scope issue.
4. **403 em endpoints que normalmente funcionariam** = quota mode restriction.

---

## 5. Rate Limits

- Janela: **rolling 30s**.
- 429 retorna header **`Retry-After`** (segundos).
- Endpoints como upload de cover image têm limites custom (mais baixos).
- Optimizações:
  - Endpoints batch (`Get Multiple Albums`, `Get Several Artists`).
  - Lazy loading.
  - Monitor via Developer Dashboard.

Handler recomendado:

```typescript
if (res.status === 429) {
  const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
  await new Promise(r => setTimeout(r, retryAfter * 1000));
  // retry once
}
```

> Não está implementado no `spotifyFetch` actual. Aceitável para volume baixo (cron diário + ~5 song requests/dia), mas vale adicionar quando escalar.

---

## 6. Códigos de Erro

| Code | Significado | Acção |
|---|---|---|
| 200 | OK | — |
| 201 | Created (POST playlist/tracks) | — |
| 204 | No Content (DELETE) | — |
| 400 | Bad Request — JSON malformado, params inválidos | Logar body completo, corrigir |
| 401 | Token inválido/expirado | **Refresh + retry** (já implementado em `client.ts:60-65`) |
| 403 | Forbidden — **3 causas distintas** | Ver abaixo |
| 404 | Not Found — recurso não existe ou sem permissões | Logar `playlist_id` |
| 429 | Rate limit | Honrar `Retry-After` |
| 500/502/503 | Spotify down | Retry com backoff |

### 403 — Diagnóstico

As três causas, por ordem de probabilidade no Strike's House:

1. **Development Mode quota restriction** — endpoint ou utilizador bloqueado pelo modo da app. Ver [[#Quota Modes — A causa do 403]].
2. **Scope insuficiente** — token foi emitido com scopes que não cobrem o endpoint. Validar `scope` no DB (`spotifyToken.scope`). Para adicionar scope, **forçar re-OAuth com `show_dialog=true`**.
3. **Recurso não pertence ao user** — ex: editar playlist de outro user sem ser colaborador. Não é o nosso caso (criamos as próprias playlists).

### Body do erro

```json
{
  "error": {
    "status": 403,
    "message": "Insufficient client scope"
    // OR "message": "Please verify ..." (development mode)
  }
}
```

**Sempre logar `error.message`** — é a única forma de distinguir as 3 causas.

---

## 7. Endpoints que usamos (referência completa)

### 7.1 `GET /v1/me` — Identificar dono

- **Scopes**: `user-read-private`, `user-read-email`
- **Uso**: callback OAuth para saber `spotifyUserId` (dono das playlists).
- **Response chave**:
  ```json
  {
    "id": "string",
    "display_name": "string | null",
    "email": "string",
    "country": "PT",
    "product": "premium" | "free" | "open",
    "uri": "spotify:user:..."
  }
  ```
- **Gotcha**: `country` e `product` só vêm com `user-read-private`. Sem essa scope, response é "magrinho" e parece estar partido. Foi um sintoma do bug original (descoberto via diagnostic script).

### 7.2 `POST /v1/me/playlists` — Criar playlist (NÃO `/users/{id}/playlists`)

- **Scopes**: `playlist-modify-public` (se `public:true`) ou `playlist-modify-private` (se `public:false`).
- **Body**:
  ```json
  {
    "name": "string (required, não-único)",
    "public": true,
    "collaborative": false,
    "description": "string"
  }
  ```
- **Restrição**: `collaborative:true` exige `public:false`.
- **Response 201**: objecto playlist completo com `id`, `snapshot_id`, `uri`, etc.
- **Gotcha CRÍTICO**: `POST /v1/users/{user_id}/playlists` retorna **403 em Development Mode mesmo para o app owner** (descoberto em produção — ver commit `a0716e8`). Usar **sempre** `/me/playlists`. Documentação oficial deprecou o endpoint `/users/{id}/playlists`.

### 7.3 `GET /v1/playlists/{playlist_id}/tracks` — Ler tracks

- **Scope**: `playlist-read-private` (suficiente para públicas e privadas — single scope umbrella).
- **Query params**:
  - `market` (ISO 3166-1, ex: `PT`) — filtra availability.
  - `fields` — projection (ex: `items(track(uri)),next`).
  - `limit` (1–50, default 20).
  - `offset` (paginação).
  - `additional_types=track,episode`.
- **Response**:
  ```json
  {
    "href": "...",
    "limit": 100,
    "next": "url|null",
    "offset": 0,
    "total": 4,
    "items": [
      {
        "added_at": "ISO",
        "added_by": { "id": "..." },
        "is_local": false,
        "track": { "uri": "spotify:track:..." }
      }
    ]
  }
  ```
- **Paginação**: seguir `next` até `null`. Implementado em `fetchAllBaseTracks` (`src/lib/spotify/playlist-manager.ts:25-43`).
- **Bug actual**: este endpoint retorna **403 em Development Mode mesmo para o app owner** quando lê a base playlist. Hipóteses em investigação:
  - Base playlist tem origem "Spotify-curated" (não user-created) → bloqueada em dev mode.
  - Conta Spotify do dono não está realmente Premium activo.
  - Scope `playlist-read-private` foi perdida em refresh anterior.

### 7.4 `POST /v1/playlists/{playlist_id}/tracks` — Adicionar tracks

- **Scopes**: `playlist-modify-public` ou `playlist-modify-private`.
- **Query params**:
  - `uris` — CSV de URIs (alternativa ao body, max 100).
  - `position` — index 0-based onde inserir.
- **Body** (preferido):
  ```json
  {
    "uris": ["spotify:track:...", "..."],
    "position": 0
  }
  ```
- **Limite**: **100 items por request**.
- **Response 201**: `{ "snapshot_id": "..." }`.
- **Semântica de `position`**:
  - Omitido → append no fim.
  - `0` → topo (push existing down).
  - Out-of-bounds → append no fim (silencioso, não erra).

### 7.5 `DELETE /v1/playlists/{playlist_id}/tracks` — Remover tracks

- **Scopes**: `playlist-modify-public` ou `playlist-modify-private`.
- **Body**:
  ```json
  {
    "tracks": [
      { "uri": "spotify:track:..." },
      { "uri": "spotify:track:...", "positions": [0, 3] }
    ],
    "snapshot_id": "optional, optimistic concurrency"
  }
  ```
- **Sem `positions`**: remove **todas** as ocorrências dessa URI.
- **Com `positions`**: remove apenas em índices específicos.
- **Limite**: 100 items por request.
- **Response 200**: `{ "snapshot_id": "..." }`.

### 7.6 `GET /v1/search` — Procurar música

- **Scope**: nenhuma específica (qualquer token válido — user ou client credentials).
- **Query params**:
  - `q` (required) — query. Operadores: `artist:X`, `track:Y`, `album:Z`, `year:2020`, `genre:rock`, `tag:new`, `tag:hipster`, `isrc:...`, `upc:...`.
  - `type` (required) — CSV: `track,artist,album,playlist,show,episode,audiobook`.
  - `market` — código país.
  - `limit` (0–10 doc diz; na prática **0–50**, default 5).
  - `offset` (0–1000).
  - `include_external=audio` — sinal de cliente que pode reproduzir external content.
- **Response**: objecto com chave por type:
  ```json
  {
    "tracks": {
      "href": "...", "limit": 5, "offset": 0, "total": 100,
      "next": "url", "previous": null,
      "items": [/* TrackObject */]
    }
  }
  ```
- **Uso**: WhatsApp song request flow procura faixa por nome de artista/música antes de adicionar.

### 7.7 `GET /v1/artists/{id}` — Para genre filter

- **Scope**: nenhuma específica.
- **Response chave**:
  ```json
  {
    "id": "string",
    "name": "string",
    "genres": ["string"], // pode ser []
    "popularity": 0-100,
    "uri": "spotify:artist:..."
  }
  ```
- **Gotcha**: `genres` **pode ser array vazio** se Spotify não tiver classificado o artista. Não confiar em `genres` como exclusivo para blocklist — usar também blocklist explícita por nome de artista (já implementado em `genre-filter.ts`).

---

## 7.bis Filtro de conteúdo — Block + Allow + Normalização (2026-05-27)

O `genre-filter.ts` aplica regras nesta ordem (a primeira que dispara, vence):

1. **`track.explicit === true` → reject_explicit**
   Regra dura do Marcelo (ambiente família na recepção). Override absoluto — nem allowlist passa.
2. **`WaBlockedArtist` (Spotify artist ID) → reject_artist**
   Match preciso por ID. Imune a falsos positivos.
3. **`WaAllowedArtist` (Spotify artist ID) → accept (skip keyword filter)**
   Curinga para artistas cujos nomes/géneros bateriam por substring no keyword filter.
   Ex: **Poesia Acústica** (trap BR) é apanhado por `"acústico"`/`"acoustic"` — allowlist resolve.
4. **Keyword filter** (`WaBlockedGenre`):
   Substring match contra **3 campos** — `artist.genres[]`, `artist.name`, `track.name`.
   **Normalização NFD** em ambos os lados: `"axé"` ↔ `"axe music"` ↔ `"modão"` ↔ `"modao"`.

### Porque normalização > fuzzy matching

Considerámos fuzzysort (proposta com `threshold: -10000`) e descartámos:

- Threshold permissivo → false positives massivos (`"Drake"` ↔ `"brega"`, `"Dua Lipa"` ↔ `"pimba"`).
- Threshold restritivo → não apanha `"fadistas"` vs `"fadista"`, que o `includes()` simples já apanha.
- Variação ortográfica em pt-PT/pt-BR é **acentos**, não tipos — `.normalize("NFD").replace(/\p{Diacritic}/gu, "")` resolve sem dependências.
- Audio features (BPM/energy/valence/danceability/speechiness) **não** estão acessíveis em Development Mode desde Nov 2024 — usar essas features re-introduziria o 403 que resolvemos com a migração `/tracks` → `/items`.

### Schemas (Prisma)

```prisma
model WaBlockedGenre {
  id        String   @id @default(cuid())
  keyword   String   @unique  // armazenado em lower-case; comparação faz NFD em ambos os lados
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

model WaAllowedArtist {
  spotifyArtistId String   @id
  artistName      String
  reason          String?
  addedBy         String
  addedAt         DateTime @default(now())
}
```

### Gestão admin

- **API**: `GET|POST|DELETE /api/whatsapp/admin/spotify-blocklist` (genres + artists), `GET|POST|DELETE /api/whatsapp/admin/spotify-allowlist` (só artists). Ambas requerem role `admin`.
- **UI**: `/dashboard/wa/blocklist` e `/dashboard/wa/allowlist`.
- **Seeds**: `prisma/seed/seed-blocked-genres.ts` (~75 keywords), `prisma/seed/seed-allowed-artists.ts` (vazio até preencheres o Spotify artist ID).

### Como obter um Spotify artist ID

Via search (qualquer token válido):

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.spotify.com/v1/search?q=poesia%20acustica&type=artist&limit=5"
```

Ou via URL do app: `https://open.spotify.com/artist/{ID}?si=...` → o `{ID}` é os 22 caracteres base-62.

---

## 8. URI / ID formats

| Tipo | URI | ID isolado |
|---|---|---|
| Track | `spotify:track:6rqhFgbbKwnb9MLmUQDhG6` | `6rqhFgbbKwnb9MLmUQDhG6` |
| Playlist | `spotify:playlist:37i9dQZF1DXcBWIGoYBM5M` | `37i9dQZF1DXcBWIGoYBM5M` |
| Artist | `spotify:artist:0TnOYISbd1XYRBk9myaseg` | `0TnOYISbd1XYRBk9myaseg` |
| User | `spotify:user:wizzler` | `wizzler` |
| Album | `spotify:album:...` | `...` |

**Conversão URL ↔ URI**:

- `https://open.spotify.com/track/{id}?si=...` ↔ `spotify:track:{id}`
- O `?si=...` é tracking, descartar.

ID = 22 caracteres base-62 (alphanumeric).

---

## 9. Implementação actual no repo

### Ficheiros-chave

| Path | Responsabilidade |
|---|---|
| `src/lib/spotify/client.ts` | `spotifyFetch` — auth, retry 401, refresh access token cache |
| `src/lib/spotify/token-store.ts` | Encrypt/decrypt refresh token (AES-256-GCM) + persist no Prisma singleton |
| `src/lib/spotify/playlist-manager.ts` | `createClassPlaylist`, `insertSongAtNextPosition`, `removeSongAndRecompress`, `swapSong` |
| `src/lib/spotify/genre-filter.ts` | Blocklist por genre + artist name |
| `src/app/api/spotify/login/route.ts` | OAuth step 1 — redirect to `/authorize` |
| `src/app/api/spotify/callback/route.ts` | OAuth step 2-3 — code → tokens → `/me` → persist |
| `src/app/api/cron/spotify-playlists/route.ts` | Cron diário cria playlists das aulas do dia |
| `src/lib/wa/handlers/song-request.ts` | Handler WhatsApp para pedido de música |

### Env vars

```
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=https://strikehousedashboard.vercel.app/api/spotify/callback
SPOTIFY_BASE_PLAYLIST_ID=     # playlist mestre semeadora (22-char ID)
SPOTIFY_TOKEN_ENCRYPTION_KEY= # 32 bytes base64
CRON_SECRET=                  # auth do cron Vercel
```

### Storage

Tabela Prisma `SpotifyToken` (singleton com `id = "singleton"`):
- `ciphertext`, `iv`, `authTag` — AES-256-GCM do refresh_token
- `spotifyUserId` — dono das playlists
- `scope` — scopes concedidas (para diagnóstico)

Tabela `WaClassPlaylist`:
- `yogoClassId` ↔ `spotifyPlaylistId` — mapeia aulas Yogo para playlists Spotify
- `requestCount` — posição FIFO para inserções

---

## 10. Gotchas conhecidos

1. **`POST /users/{id}/playlists` retorna 403 em dev mode** — usar `/me/playlists`. Fix: commit `a0716e8`.
2. **Adicionar scopes não rotaciona refresh token existente** — após editar `SCOPES` em `login/route.ts`, forçar re-OAuth (admin clica "Re-autenticar" em `/dashboard/wa/spotify-auth`).
3. **`refresh_token` na response do refresh é opcional** — código actual não persiste novo refresh_token (bomba relógio).
4. **`country` e `product` no `/me` precisam de `user-read-private`** — sem essa scope o response parece estar partido. Fix: commit `f837f01`.
5. **`playlist-read-private` é umbrella** — cobre playlists públicas E privadas do user.
6. **`genres` em `/artists/{id}` pode ser `[]`** — não classificado pelo Spotify. Genre filter precisa de fallback por nome de artista.
7. **Search `limit` doc diz 0–10 mas API aceita 0–50**.
8. **Encryption key tem de ter exactamente 32 bytes base64** (256 bits) — validado em `token-store.ts:10`.
9. **Cron auth via `Authorization: Bearer ${CRON_SECRET}`** — Vercel Cron envia este header automaticamente quando configurado em `vercel.json`.

---

## 11. Scripts de diagnóstico no repo

Em `debug/` há scripts standalone para testar o token directamente (criados durante a investigação do 403):

- `debug/spotify-diagnostic.js` — Lê token encriptado do DB, chama `/me`, valida scopes, inspecciona headers.
- `debug/spotify-multi-playlist-test.js` — Testa `GET /playlists/{id}/tracks` contra várias playlists para isolar se é por playlist ou universal.
- `debug/spotify-write-test.js` — Testa write operations vs read restrictions.

Rodar com `node debug/spotify-diagnostic.js` (carrega `.env.local` manualmente).

---

## 12. Hipóteses abertas para o bug 403

Em ordem decreasing de probabilidade:

1. **Conta dona da app não está Premium activo** — Spotify exige Premium para Development Mode funcionar. Verificar com `GET /me` que `product === "premium"`.
2. **Base playlist é "Spotify-owned" (curated)** — playlists tipo "Today's Top Hits" (`37i9dQZF1DXcBWIGoYBM5M`) podem ter restrições especiais. Solução: criar base playlist como playlist privada do user dono.
3. **Refresh token foi emitido antes da expansão de scopes** — confirmar `scope` no DB inclui `playlist-read-private`. Se não, re-OAuth.
4. **Endpoints de read foram restritos em Nov 2024** — alguns endpoints da Web API foram limitados a Extended Quota. Verificar changelog Spotify.

**Próximo passo recomendado**: correr `debug/spotify-diagnostic.js` em produção e ler `error.message` do response 403 — é a única forma fiável de distinguir as 4 hipóteses.

---

## 13. Referências

### Docs oficiais

- Web API home: https://developer.spotify.com/documentation/web-api
- Authorization Code flow: https://developer.spotify.com/documentation/web-api/tutorials/code-flow
- Refresh tokens: https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens
- Scopes: https://developer.spotify.com/documentation/web-api/concepts/scopes
- Quota modes: https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- Rate limits: https://developer.spotify.com/documentation/web-api/concepts/rate-limits
- API calls/errors: https://developer.spotify.com/documentation/web-api/concepts/api-calls
- Playlists concepts: https://developer.spotify.com/documentation/web-api/concepts/playlists

### Endpoints (referência)

- Create playlist: https://developer.spotify.com/documentation/web-api/reference/create-playlist
- Add tracks: https://developer.spotify.com/documentation/web-api/reference/add-tracks-to-playlist
- Remove tracks: https://developer.spotify.com/documentation/web-api/reference/remove-tracks-playlist
- Get playlist items: https://developer.spotify.com/documentation/web-api/reference/get-playlists-tracks
- Search: https://developer.spotify.com/documentation/web-api/reference/search
- Get current user: https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile
- Get artist: https://developer.spotify.com/documentation/web-api/reference/get-an-artist

### Vault relacionado

- [[Spotify-Playlist-Per-Class-Design]] — spec do feature
- [[Gotchas]] — gotchas gerais do projecto
- [[Yogo-API]] — fonte das aulas que recebem playlist
- [[WhatsApp-Bot-v1-Spec]] — bot que dispara song requests
