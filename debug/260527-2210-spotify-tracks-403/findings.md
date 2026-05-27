# Findings — Spotify /tracks 403 Investigation

## ✅ ROOT CAUSE — [HIGH] Spotify deprecated `/playlists/{id}/tracks` for this app; must use `/playlists/{id}/items`

- **Location:** `src/lib/spotify/playlist-manager.ts` (all `${id}/tracks` URLs)
- **Hypothesis:** The `/tracks` subresource is restricted/deprecated for new apps; the replacement is `/items` (unified track + episode model).
- **Evidence:**
  - `GET /v1/playlists/5fXQ.../items` → **200** with full content body
  - `POST /v1/playlists/4Jeo.../items` → **201 Created** with `snapshot_id`
  - Same playlists, same token, same scopes → `/tracks` returns 403
  - Playlist metadata response has key `items`, NOT `tracks` (the entire `tracks` subobject is missing — `tracks.total: undefined`)
  - `/me/tracks` returns explicit `"Insufficient client scope"`, while `/playlists/{id}/tracks` returns generic `"Forbidden"` — different error semantics confirm it's not a scope issue
- **Reproduction:**
  ```
  GET  /v1/playlists/<id>/tracks → 403 Forbidden
  GET  /v1/playlists/<id>/items  → 200 OK ✓
  POST /v1/playlists/<id>/tracks → 403 Forbidden
  POST /v1/playlists/<id>/items  → 201 Created ✓
  ```
- **Impact:** All FIFO insert/remove/swap operations in `playlist-manager.ts` fail. Daily cron seeds fail. Bot cannot add songs to class playlists.
- **Root cause:** Spotify Web API switched from track-only `/tracks` to the unified `/items` endpoint (supports tracks + episodes). New apps in Development Mode get a hard 403 on the legacy path. The error message "Forbidden" is misleading — it's path deprecation, not authorization failure.
- **Suggested fix:** Replace all `${playlistId}/tracks` with `${playlistId}/items` in `playlist-manager.ts`. Request/response bodies are identical (Spotify maintained backwards-compat shape). Also update reading of base playlist tracks — `items` returns same `items[].track.uri` structure.

## Eliminated hypotheses

- H2 (fields param interaction) — disproven, still 403 with any fields combo
- H3 (Spotify editorial playlist access) — separate issue, 404 not 403 (Nov 2024 deprecation)
- H4 (User-Agent missing) — disproven, 403 with or without UA
- H6 (PUT vs POST) — same 403 on PUT, same path issue
- H8 (token format / JWT-like) — token is opaque 320-char Spotify-internal format, not JWT
- H9 (rate limit headers) — no rate-limit-related response headers present
- H10 (scope confusion) — `/me/tracks` returns "Insufficient client scope" with the literal message, distinct from "/tracks endpoint" 403 with generic message
