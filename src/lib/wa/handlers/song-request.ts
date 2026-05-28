import { db } from "@/lib/db";
import { sendText } from "@/lib/wa/meta";
import { loadSession, transition, ttlFromNow, resetToIdle, type SessionRow } from "@/lib/wa/session";
import { parseSpotifyTrackId } from "@/lib/wa/parser";
import { evaluateTrack } from "@/lib/spotify/genre-filter";
import {
  insertSongAtNextPosition,
  swapSong,
  removeSongAndRecompress,
  createClassPlaylist,
} from "@/lib/spotify/playlist-manager";
import { listClasses, parseClassStart } from "@/lib/yogo/signups";

const OFFER_TEXT =
  "Queres pedir uma música para esta aula? Manda o link do Spotify ou diz 'não' para ignorar.";

const HINT_TEXT =
  "Manda o link do Spotify da música (ex: https://open.spotify.com/track/...) ou diz 'não' para ignorar.";

const WINDOW_CLOSED =
  "Esta aula já começou há mais de 10 min — pedidos fechados.";

// Create the per-class playlist on demand if the daily cron hasn't run yet
// (e.g. user reserves tomorrow's class today). Returns null if creation fails.
export async function ensureClassPlaylist(yogoClassId: number) {
  const existing = await db.waClassPlaylist.findUnique({ where: { yogoClassId } });
  if (existing) return existing;

  // Look up the class from Yogo to get name + start time
  const todayIso = new Date().toISOString().slice(0, 10);
  const inSevenDaysIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const classes = await listClasses(todayIso, inSevenDaysIso);
  const klass = classes.find((k) => k.id === yogoClassId);
  if (!klass) return null;
  // Skip non-group classes (PTs) — playlists are only for group classes
  if (typeof klass.seats === "number" && klass.seats <= 1) return null;
  const start = parseClassStart(klass);
  if (!start) return null;

  try {
    await createClassPlaylist({
      yogoClassId,
      className: klass.class_type?.name ?? `Class ${yogoClassId}`,
      startsAtIso: start.toISOString(),
    });
  } catch {
    return null;
  }
  return db.waClassPlaylist.findUnique({ where: { yogoClassId } });
}

export async function offerSongRequest(phoneE164: string, yogoClassId: number): Promise<void> {
  const playlist = await ensureClassPlaylist(yogoClassId);
  if (!playlist || playlist.locked) return;

  const existing = await db.waSongRequest.findFirst({
    where: { contactId: phoneE164, yogoClassId, status: "active" },
  });
  if (existing) return;

  const session = await loadSession(phoneE164);
  const t = await transition(session, {
    state: "AWAIT_SONG_INPUT",
    pendingSongClassId: yogoClassId,
    expiresAt: ttlFromNow(),
  });
  if (!t.ok) return;

  await sendText(phoneE164, OFFER_TEXT);
}

export async function handleSongInput(session: SessionRow, body: string): Promise<void> {
  const phoneE164 = session.phoneE164;
  const text = body.trim().toLowerCase();

  // 'não' / 'nao' / 'no' / 'n' → cancel
  if (text === "não" || text === "nao" || text === "no" || text === "n") {
    await resetToIdle(session);
    return;
  }

  const trackId = parseSpotifyTrackId(body);
  if (!trackId) {
    await sendText(phoneE164, HINT_TEXT);
    return;
  }

  if (!session.pendingSongClassId) {
    await sendText(
      phoneE164,
      "Não consegui ligar este pedido a uma aula tua. Diz 'reserva' para começar de novo 🥷",
    );
    await resetToIdle(session);
    return;
  }
  const yogoClassId = session.pendingSongClassId;

  const playlist = await db.waClassPlaylist.findUnique({ where: { yogoClassId } });
  if (!playlist) {
    await sendText(
      phoneE164,
      "A playlist desta aula ainda não está pronta. Tenta de novo daqui a 1min 🥷",
    );
    await resetToIdle(session);
    return;
  }
  if (playlist.locked) {
    await db.waSongRequest.create({
      data: {
        contactId: phoneE164,
        yogoClassId,
        spotifyTrackId: trackId,
        spotifyTrackName: "(window closed)",
        spotifyArtistName: "(window closed)",
        spotifyTrackUri: `spotify:track:${trackId}`,
        position: -1,
        status: "rejected_window",
        rejectedReason: "playlist locked",
      },
    });
    await sendText(phoneE164, WINDOW_CLOSED);
    await resetToIdle(session);
    return;
  }

  const result = await evaluateTrack(trackId);

  if (result.outcome === "reject_genre") {
    await db.waSongRequest.create({
      data: {
        contactId: phoneE164,
        yogoClassId,
        spotifyTrackId: trackId,
        spotifyTrackName: result.trackName,
        spotifyArtistName: result.artistName,
        spotifyTrackUri: `spotify:track:${trackId}`,
        position: -1,
        status: "rejected_genre",
        rejectedReason: result.matchedKeyword,
      },
    });
    await sendText(
      phoneE164,
      `Esta música é classificada como ${result.matchedKeyword} pelo Spotify. A casa só toca rock, hip-hop, rap e pop. Tenta outra 🥷`
    );
    await resetToIdle(session);
    return;
  }

  if (result.outcome === "reject_artist") {
    await db.waSongRequest.create({
      data: {
        contactId: phoneE164,
        yogoClassId,
        spotifyTrackId: trackId,
        spotifyTrackName: result.trackName,
        spotifyArtistName: result.artistName,
        spotifyTrackUri: `spotify:track:${trackId}`,
        position: -1,
        status: "rejected_artist",
        rejectedReason: result.blockedArtistName,
      },
    });
    await sendText(
      phoneE164,
      `O artista ${result.blockedArtistName} está bloqueado. Tenta outra música 🥷`
    );
    await resetToIdle(session);
    return;
  }

  if (result.outcome === "reject_explicit") {
    await db.waSongRequest.create({
      data: {
        contactId: phoneE164,
        yogoClassId,
        spotifyTrackId: trackId,
        spotifyTrackName: result.trackName,
        spotifyArtistName: result.artistName,
        spotifyTrackUri: `spotify:track:${trackId}`,
        position: -1,
        status: "rejected_explicit",
        rejectedReason: "explicit content",
      },
    });
    await sendText(
      phoneE164,
      `*${result.trackName}* — ${result.artistName} tem conteúdo explícito 🚫\n\nA Strike não toca explícitas na aula. Procura a versão *Clean* / *Radio Edit* no Spotify e tenta de novo 🥷`
    );
    await resetToIdle(session);
    return;
  }

  // Accept → ask for confirmation
  const t = await transition(session, {
    state: "AWAIT_SONG_CONFIRM",
    pendingTrackId: result.trackId,
    expiresAt: ttlFromNow(),
  });
  if (!t.ok) {
    // Race lost — session was bumped between dispatch and here. Tell the user
    // something rather than silently dropping. Log for observability.
    await db.waEvent.create({
      data: {
        kind: "SESSION_RACE",
        phoneE164,
        meta: JSON.stringify({ where: "handleSongInput.accept", trackId }),
      },
    }).catch(() => undefined);
    await sendText(
      phoneE164,
      "Cruzaram-se mensagens. Diz 'reserva' e tenta de novo 🥷",
    );
    return;
  }

  await sendText(
    phoneE164,
    `Vais ouvir *${result.trackName}* — ${result.artistName} 🎵\nConfirmar? (sim/não)`
  );
}

export async function handleSongConfirm(session: SessionRow, body: string): Promise<void> {
  const phoneE164 = session.phoneE164;
  const text = body.trim().toLowerCase();

  if (text === "não" || text === "nao" || text === "n" || text === "no") {
    await sendText(phoneE164, "Ok, pedido cancelado 🥷");
    await resetToIdle(session);
    return;
  }
  if (!(text === "sim" || text === "s" || text === "yes" || text === "y")) {
    await sendText(phoneE164, "Responde 'sim' ou 'não'.");
    return;
  }

  if (!session.pendingSongClassId || !session.pendingTrackId) {
    await sendText(phoneE164, "Perdi o contexto do pedido. Diz 'reserva' para começar de novo 🥷");
    await resetToIdle(session);
    return;
  }
  const yogoClassId = session.pendingSongClassId;
  const trackId = session.pendingTrackId;

  const result = await evaluateTrack(trackId);
  if (result.outcome !== "accept") {
    await sendText(phoneE164, "A música deixou de ser aceitável (verificação falhou). Tenta outra 🥷");
    await resetToIdle(session);
    return;
  }

  const existing = await db.waSongRequest.findFirst({
    where: { contactId: phoneE164, yogoClassId, status: "active" },
  });

  if (existing) {
    const t = await transition(session, {
      state: "AWAIT_SWAP_CONFIRM",
      pendingSongClassId: yogoClassId,
      pendingTrackId: trackId,
      expiresAt: ttlFromNow(),
    });
    if (!t.ok) {
      await db.waEvent.create({
        data: { kind: "SESSION_RACE", phoneE164, meta: JSON.stringify({ where: "handleSongConfirm.swap" }) },
      }).catch(() => undefined);
      await sendText(phoneE164, "Cruzaram-se mensagens. Diz 'reserva' e tenta de novo 🥷");
      return;
    }
    await sendText(
      phoneE164,
      `Já pediste "${existing.spotifyTrackName} — ${existing.spotifyArtistName}" para esta aula.\nQueres trocar pela nova (${result.trackName} — ${result.artistName})? (sim/não)`
    );
    return;
  }

  let ins;
  try {
    ins = await insertSongAtNextPosition({
      yogoClassId,
      trackUri: result.trackUri,
    });
  } catch (err) {
    await db.waEvent.create({
      data: {
        kind: "SONG_INSERT_FAIL",
        phoneE164,
        meta: JSON.stringify({ yogoClassId, trackUri: result.trackUri, error: String(err) }),
      },
    }).catch(() => undefined);
    await sendText(
      phoneE164,
      "Falhou a adicionar à playlist (erro no Spotify). Tenta outra vez daqui a 1min 🥷",
    );
    await resetToIdle(session);
    return;
  }

  await db.waSongRequest.create({
    data: {
      contactId: phoneE164,
      yogoClassId,
      spotifyTrackId: result.trackId,
      spotifyTrackName: result.trackName,
      spotifyArtistName: result.artistName,
      spotifyTrackUri: result.trackUri,
      position: ins.position,
      status: "active",
    },
  });

  const playlist = await db.waClassPlaylist.findUnique({ where: { yogoClassId } });
  const playlistLink = playlist
    ? `\nhttps://open.spotify.com/playlist/${playlist.spotifyPlaylistId}`
    : "";
  const positionMsg = ins.position === 0 ? "1ª" : `${ins.position + 1}ª`;
  await sendText(
    phoneE164,
    `Adicionado! 🥷\n\n*${result.trackName}* — ${result.artistName}\nVai tocar na ${positionMsg} posição da playlist da tua aula.${playlistLink}`
  );
  await resetToIdle(session);
}

export async function removeSongOnCancel(phoneE164: string, yogoClassId: number): Promise<void> {
  const active = await db.waSongRequest.findFirst({
    where: { contactId: phoneE164, yogoClassId, status: "active" },
  });
  if (!active) return;
  try {
    await removeSongAndRecompress(active.id);
  } catch (err) {
    await db.waEvent.create({
      data: {
        kind: "SONG_REMOVE_FAIL",
        phoneE164,
        meta: JSON.stringify({ requestId: active.id, error: String(err) }),
      },
    });
  }
}

export async function handleSwapConfirm(session: SessionRow, body: string): Promise<void> {
  const phoneE164 = session.phoneE164;
  const text = body.trim().toLowerCase();

  if (!(text === "sim" || text === "s" || text === "yes" || text === "y")) {
    await sendText(phoneE164, "Pedido cancelado. Música anterior mantida.");
    await resetToIdle(session);
    return;
  }

  if (!session.pendingSongClassId || !session.pendingTrackId) {
    await resetToIdle(session);
    return;
  }
  const yogoClassId = session.pendingSongClassId;
  const trackId = session.pendingTrackId;

  const old = await db.waSongRequest.findFirst({
    where: { contactId: phoneE164, yogoClassId, status: "active" },
  });
  if (!old) {
    await resetToIdle(session);
    return;
  }

  const result = await evaluateTrack(trackId);
  if (result.outcome !== "accept") {
    await resetToIdle(session);
    return;
  }

  await swapSong({
    oldRequestId: old.id,
    newTrackUri: result.trackUri,
    newTrackId: result.trackId,
    newTrackName: result.trackName,
    newArtistName: result.artistName,
    contactId: phoneE164,
  });

  const playlist = await db.waClassPlaylist.findUnique({ where: { yogoClassId } });
  const playlistLink = playlist
    ? `\nhttps://open.spotify.com/playlist/${playlist.spotifyPlaylistId}`
    : "";
  await sendText(
    phoneE164,
    `Troca feita! 🥷\n\n*${result.trackName}* — ${result.artistName}\nSubstituiu a anterior na mesma posição.${playlistLink}`
  );
  await resetToIdle(session);
}
