---
title: Spotify Filter — Allow Explicit + Field-Scoped Keywords
type: technical
date: 2026-05-28
---

# Spotify Filter — Allow Explicit + Field-Scoped Keywords

Mudança ao filtro que decide se uma música pedida via WhatsApp entra na playlist
da aula. Ficheiro central: `src/lib/spotify/genre-filter.ts` (`evaluateTrack`).

## Problema

O filtro estava a bloquear quase tudo (ex: **Eminem**). Duas causas:

1. **Regra dura de explícito** — `if (track.explicit) return reject_explicit`. O Spotify
   marca explicit uma fatia enorme do mainstream (quase todo o hip-hop/rap, muito pop),
   por isso bloqueava demasiado.
2. **Substring match `.includes()` em 3 campos** — cada keyword era testada contra
   género **e** nome de artista **e** título. Keywords curtas vazavam entre campos:
   `"sleep"` matava `"Sleepless"`, `"adele"` (artista) matava o título `"Madeleine"`.

## Decisão

- **Permitir explicit** — removida a regra dura. Explícito deixou de ser bloqueado.
- **Match por campo** — cada keyword passa a bater **só** no campo para que foi
  registada.

## Implementação

- Schema: nova coluna `WaBlockedGenre.field` (`"genre" | "artist" | "track"`,
  default `"genre"`). Migration `20260528120000_wa_blocked_genre_field` adiciona a
  coluna e faz back-fill das keywords de artista/música existentes.
- `evaluateTrack`: removida a verificação de `track.explicit` e o outcome
  `reject_explicit`. O loop de keywords passou a ser field-scoped (`b.field`).
  Mantém a normalização de diacríticos (`norm()`), a precedência blocklist-de-artista
  e o short-circuit da allowlist.
- `song-request.ts`: removido o ramo `reject_explicit` (já não envia a mensagem de
  "conteúdo explícito").
- Rota admin `POST /api/whatsapp/admin/spotify-blocklist`: aceita `field` (default
  `genre`, validado).
- UI `/dashboard/wa/blocklist`: selector de campo ao adicionar + mostra o campo de
  cada keyword. Texto de ajuda da allowlist atualizado (já não menciona explicit).
- Seed `prisma/seed/seed-blocked-genres.ts`: keywords agrupadas por field; upsert
  passou a corrigir o `field` em linhas existentes.

## Precedência do filtro (após a mudança)

1. Artista bloqueado por Spotify ID (`reject_artist`)
2. Allowlist de artista → `accept` (ignora keywords)
3. Keyword bloqueada no **campo correspondente** (`reject_genre`,
   `matchedAgainst: genre | artist_name | track_name`)
4. Caso contrário → `accept` (explícito incluído)

## Deploy pendente

`DATABASE_URL` aponta para Turso (libsql, produção). A migration **não foi aplicada
em produção** nesta sessão — requer confirmação. Passos:

```bash
npx prisma migrate deploy      # aplica a migration no Turso
npx prisma db seed             # re-classifica os fields das keywords seed
```

## Related

- [[Spotify-API]]
- [[Spotify-Playlist-Per-Class-Design]]
- [[playlistBlackList]]