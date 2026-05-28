import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock variables are available when vi.mock factory runs (hoisted to top)
const {
  sendTextMock,
  loadSessionMock,
  transitionMock,
  ttlFromNowMock,
  resetToIdleMock,
  endInteractionMock,
  playlistFindUniqueMock,
  songRequestFindFirstMock,
  songRequestCreateMock,
  waEventCreateMock,
  evaluateTrackMock,
  insertSongAtNextPositionMock,
  swapSongMock,
  removeSongAndRecompressMock,
} = vi.hoisted(() => ({
  sendTextMock: vi.fn(),
  loadSessionMock: vi.fn(),
  transitionMock: vi.fn(),
  ttlFromNowMock: vi.fn(),
  resetToIdleMock: vi.fn(),
  endInteractionMock: vi.fn(),
  playlistFindUniqueMock: vi.fn(),
  songRequestFindFirstMock: vi.fn(),
  songRequestCreateMock: vi.fn(),
  waEventCreateMock: vi.fn(),
  evaluateTrackMock: vi.fn(),
  insertSongAtNextPositionMock: vi.fn(),
  swapSongMock: vi.fn(),
  removeSongAndRecompressMock: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const dbMock = {
    waClassPlaylist: {
      findUnique: playlistFindUniqueMock,
    },
    waSongRequest: {
      findFirst: songRequestFindFirstMock,
      create: songRequestCreateMock,
    },
    waEvent: {
      create: waEventCreateMock,
    },
  };
  return { db: dbMock };
});

vi.mock("@/lib/spotify/genre-filter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/spotify/genre-filter")>();
  return { ...actual, evaluateTrack: evaluateTrackMock };
});

vi.mock("@/lib/spotify/playlist-manager", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/spotify/playlist-manager")>();
  return {
    ...actual,
    insertSongAtNextPosition: insertSongAtNextPositionMock,
    swapSong: swapSongMock,
    removeSongAndRecompress: removeSongAndRecompressMock,
  };
});

vi.mock("@/lib/wa/meta", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wa/meta")>();
  return { ...actual, sendText: sendTextMock };
});

vi.mock("@/lib/wa/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wa/session")>();
  return {
    ...actual,
    loadSession: loadSessionMock,
    transition: transitionMock,
    ttlFromNow: ttlFromNowMock,
    resetToIdle: resetToIdleMock,
  };
});

vi.mock("@/lib/wa/handlers/menu", () => ({
  endInteraction: endInteractionMock,
  sendMenu: vi.fn(),
  handleOutros: vi.fn(),
  handleContacto: vi.fn(),
}));

import { offerSongRequest, handleSongInput, handleSongConfirm, handleSwapConfirm, removeSongOnCancel } from "@/lib/wa/handlers/song-request";

const PHONE = "+351912345678";
const CLASS_ID = 42;

const FAKE_SESSION = {
  phoneE164: PHONE,
  state: "IDLE",
  pendingClassId: null,
  pendingSignupId: null,
  pendingSongClassId: null,
  pendingTrackId: null,
  expiresAt: null,
  version: 0,
};

const FAKE_EXPIRES = new Date(Date.now() + 600_000);

describe("offerSongRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ttlFromNowMock.mockReturnValue(FAKE_EXPIRES);
  });

  it("no playlist → returns without sending any message", async () => {
    playlistFindUniqueMock.mockResolvedValueOnce(null);

    await offerSongRequest(PHONE, CLASS_ID);

    expect(sendTextMock).not.toHaveBeenCalled();
    expect(loadSessionMock).not.toHaveBeenCalled();
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it("locked playlist → returns without sending any message", async () => {
    playlistFindUniqueMock.mockResolvedValueOnce({
      id: "cuid1",
      yogoClassId: CLASS_ID,
      spotifyPlaylistId: "pl42",
      requestCount: 3,
      locked: true,
      createdAt: new Date(),
    });

    await offerSongRequest(PHONE, CLASS_ID);

    expect(sendTextMock).not.toHaveBeenCalled();
    expect(loadSessionMock).not.toHaveBeenCalled();
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it("already has active request → skips silently without sending", async () => {
    playlistFindUniqueMock.mockResolvedValueOnce({
      id: "cuid1",
      yogoClassId: CLASS_ID,
      spotifyPlaylistId: "pl42",
      requestCount: 1,
      locked: false,
      createdAt: new Date(),
    });
    songRequestFindFirstMock.mockResolvedValueOnce({
      id: "req1",
      contactId: PHONE,
      yogoClassId: CLASS_ID,
      status: "active",
    });

    await offerSongRequest(PHONE, CLASS_ID);

    expect(sendTextMock).not.toHaveBeenCalled();
    expect(loadSessionMock).not.toHaveBeenCalled();
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it("playlist exists, no prior request → sends offer and transitions session to AWAIT_SONG_INPUT", async () => {
    playlistFindUniqueMock.mockResolvedValueOnce({
      id: "cuid1",
      yogoClassId: CLASS_ID,
      spotifyPlaylistId: "pl42",
      requestCount: 0,
      locked: false,
      createdAt: new Date(),
    });
    songRequestFindFirstMock.mockResolvedValueOnce(null);
    loadSessionMock.mockResolvedValueOnce(FAKE_SESSION);
    transitionMock.mockResolvedValueOnce({
      ok: true,
      session: {
        ...FAKE_SESSION,
        state: "AWAIT_SONG_INPUT",
        pendingSongClassId: CLASS_ID,
        expiresAt: FAKE_EXPIRES,
        version: 1,
      },
    });
    sendTextMock.mockResolvedValueOnce({ ok: true, status: 200, body: "" });

    await offerSongRequest(PHONE, CLASS_ID);

    expect(loadSessionMock).toHaveBeenCalledWith(PHONE);
    expect(transitionMock).toHaveBeenCalledWith(FAKE_SESSION, {
      state: "AWAIT_SONG_INPUT",
      pendingSongClassId: CLASS_ID,
      expiresAt: FAKE_EXPIRES,
    });
    expect(sendTextMock).toHaveBeenCalledTimes(1);
    expect(sendTextMock).toHaveBeenCalledWith(
      PHONE,
      "Queres pedir uma música para esta aula? Manda o link do Spotify ou diz 'não' para ignorar.",
    );
  });

  it("transition race → no message sent", async () => {
    playlistFindUniqueMock.mockResolvedValueOnce({
      id: "cuid1",
      yogoClassId: CLASS_ID,
      spotifyPlaylistId: "pl42",
      requestCount: 0,
      locked: false,
      createdAt: new Date(),
    });
    songRequestFindFirstMock.mockResolvedValueOnce(null);
    loadSessionMock.mockResolvedValueOnce(FAKE_SESSION);
    transitionMock.mockResolvedValueOnce({ ok: false, reason: "race" });

    await offerSongRequest(PHONE, CLASS_ID);

    expect(sendTextMock).not.toHaveBeenCalled();
  });
});

const AWAIT_INPUT_SESSION = {
  phoneE164: PHONE,
  state: "AWAIT_SONG_INPUT",
  pendingClassId: null,
  pendingSignupId: null,
  pendingSongClassId: CLASS_ID,
  pendingTrackId: null,
  expiresAt: new Date(Date.now() + 600_000),
  version: 1,
};

const OPEN_PLAYLIST = {
  id: "cuid2",
  yogoClassId: CLASS_ID,
  spotifyPlaylistId: "pl42",
  requestCount: 0,
  locked: false,
  createdAt: new Date(),
};

const SPOTIFY_LINK = "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC";
const TRACK_ID = "4uLU6hMCjMI75M1A2tKUQC";

describe("handleSongInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ttlFromNowMock.mockReturnValue(FAKE_EXPIRES);
    resetToIdleMock.mockResolvedValue({ ok: true, session: { ...AWAIT_INPUT_SESSION, state: "IDLE" } });
    songRequestCreateMock.mockResolvedValue({});
    sendTextMock.mockResolvedValue({ ok: true, status: 200, body: "" });
  });

  it("'não' → resets to idle, no message sent", async () => {
    await handleSongInput(AWAIT_INPUT_SESSION, "não");

    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_INPUT_SESSION, PHONE);
    expect(sendTextMock).not.toHaveBeenCalled();
    expect(evaluateTrackMock).not.toHaveBeenCalled();
  });

  it("unparseable text → sends hint, stays in AWAIT_SONG_INPUT (no reset, no evaluate)", async () => {
    await handleSongInput(AWAIT_INPUT_SESSION, "alguma coisa aleatória");

    expect(sendTextMock).toHaveBeenCalledOnce();
    expect(sendTextMock).toHaveBeenCalledWith(
      PHONE,
      "Manda o link do Spotify da música (ex: https://open.spotify.com/track/...) ou diz 'não' para ignorar.",
    );
    expect(endInteractionMock).not.toHaveBeenCalled();
    expect(evaluateTrackMock).not.toHaveBeenCalled();
  });

  it("locked playlist → creates rejected_window record, sends WINDOW_CLOSED message, resets", async () => {
    playlistFindUniqueMock.mockResolvedValueOnce({ ...OPEN_PLAYLIST, locked: true });

    await handleSongInput(AWAIT_INPUT_SESSION, SPOTIFY_LINK);

    expect(songRequestCreateMock).toHaveBeenCalledOnce();
    expect(songRequestCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "rejected_window",
        rejectedReason: "playlist locked",
        spotifyTrackId: TRACK_ID,
      }),
    });
    expect(sendTextMock).toHaveBeenCalledWith(
      PHONE,
      "Esta aula já começou há mais de 10 min — pedidos fechados.",
    );
    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_INPUT_SESSION, PHONE);
    expect(evaluateTrackMock).not.toHaveBeenCalled();
  });

  it("genre rejection → creates rejected_genre record, sends genre message, resets", async () => {
    playlistFindUniqueMock.mockResolvedValueOnce(OPEN_PLAYLIST);
    evaluateTrackMock.mockResolvedValueOnce({
      outcome: "reject_genre",
      matchedKeyword: "sertanejo",
      trackName: "Amor Proibido",
      artistName: "Gusttavo Lima",
    });

    await handleSongInput(AWAIT_INPUT_SESSION, SPOTIFY_LINK);

    expect(evaluateTrackMock).toHaveBeenCalledWith(TRACK_ID);
    expect(songRequestCreateMock).toHaveBeenCalledOnce();
    expect(songRequestCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "rejected_genre",
        rejectedReason: "sertanejo",
        spotifyTrackId: TRACK_ID,
      }),
    });
    expect(sendTextMock).toHaveBeenCalledWith(
      PHONE,
      "Esta música é classificada como sertanejo pelo Spotify. A casa só toca rock, hip-hop, rap e pop. Tenta outra 🥷",
    );
    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_INPUT_SESSION, PHONE);
  });

  it("accepted track → transitions to AWAIT_SONG_CONFIRM and sends confirmation prompt", async () => {
    playlistFindUniqueMock.mockResolvedValueOnce(OPEN_PLAYLIST);
    evaluateTrackMock.mockResolvedValueOnce({
      outcome: "accept",
      trackId: TRACK_ID,
      trackName: "Lose Yourself",
      trackUri: `spotify:track:${TRACK_ID}`,
      artistName: "Eminem",
      artistIds: ["7dGJo4pcD2V6oG8kP0tJRR"],
    });
    transitionMock.mockResolvedValueOnce({
      ok: true,
      session: {
        ...AWAIT_INPUT_SESSION,
        state: "AWAIT_SONG_CONFIRM",
        pendingTrackId: TRACK_ID,
        expiresAt: FAKE_EXPIRES,
        version: 2,
      },
    });

    await handleSongInput(AWAIT_INPUT_SESSION, SPOTIFY_LINK);

    expect(transitionMock).toHaveBeenCalledWith(AWAIT_INPUT_SESSION, {
      state: "AWAIT_SONG_CONFIRM",
      pendingTrackId: TRACK_ID,
      expiresAt: FAKE_EXPIRES,
    });
    expect(sendTextMock).toHaveBeenCalledWith(
      PHONE,
      "Vais ouvir *Lose Yourself* — Eminem 🎵\nConfirmar? (sim/não)",
    );
    expect(endInteractionMock).not.toHaveBeenCalled();
    expect(songRequestCreateMock).not.toHaveBeenCalled();
  });
});

// ── Shared session for AWAIT_SONG_CONFIRM / AWAIT_SWAP_CONFIRM tests ──────────

const AWAIT_CONFIRM_SESSION = {
  phoneE164: PHONE,
  state: "AWAIT_SONG_CONFIRM",
  pendingClassId: null,
  pendingSignupId: null,
  pendingSongClassId: CLASS_ID,
  pendingTrackId: TRACK_ID,
  expiresAt: new Date(Date.now() + 600_000),
  version: 2,
};

const AWAIT_SWAP_SESSION = {
  ...AWAIT_CONFIRM_SESSION,
  state: "AWAIT_SWAP_CONFIRM",
  version: 3,
};

const ACCEPT_RESULT = {
  outcome: "accept" as const,
  trackId: TRACK_ID,
  trackName: "Lose Yourself",
  trackUri: `spotify:track:${TRACK_ID}`,
  artistName: "Eminem",
  artistIds: ["7dGJo4pcD2V6oG8kP0tJRR"],
};

const EXISTING_REQUEST = {
  id: "req-existing",
  contactId: PHONE,
  yogoClassId: CLASS_ID,
  spotifyTrackId: "oldTrackId",
  spotifyTrackName: "Rap God",
  spotifyArtistName: "Eminem",
  spotifyTrackUri: "spotify:track:oldTrackId",
  position: 0,
  status: "active",
};

describe("handleSongConfirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ttlFromNowMock.mockReturnValue(FAKE_EXPIRES);
    resetToIdleMock.mockResolvedValue({ ok: true, session: { ...AWAIT_CONFIRM_SESSION, state: "IDLE" } });
    sendTextMock.mockResolvedValue({ ok: true, status: 200, body: "" });
    songRequestCreateMock.mockResolvedValue({ id: "req-new" });
    insertSongAtNextPositionMock.mockResolvedValue({ position: 1 });
  });

  it("'sim' + no existing request → insertSongAtNextPosition called, WaSongRequest created with status=active, 'Adicionado!' sent, session reset", async () => {
    evaluateTrackMock.mockResolvedValueOnce(ACCEPT_RESULT);
    songRequestFindFirstMock.mockResolvedValueOnce(null);

    await handleSongConfirm(AWAIT_CONFIRM_SESSION, "sim");

    expect(evaluateTrackMock).toHaveBeenCalledWith(TRACK_ID);
    expect(insertSongAtNextPositionMock).toHaveBeenCalledWith({
      yogoClassId: CLASS_ID,
      trackUri: ACCEPT_RESULT.trackUri,
    });
    expect(songRequestCreateMock).toHaveBeenCalledOnce();
    expect(songRequestCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: PHONE,
        yogoClassId: CLASS_ID,
        spotifyTrackId: TRACK_ID,
        spotifyTrackName: "Lose Yourself",
        spotifyArtistName: "Eminem",
        status: "active",
        position: 1,
      }),
    });
    expect(sendTextMock.mock.calls[0][0]).toBe(PHONE);
    expect(sendTextMock.mock.calls[0][1]).toContain("Adicionado! 🥷");
    expect(sendTextMock.mock.calls[0][1]).toContain("Lose Yourself");
    expect(sendTextMock.mock.calls[0][1]).toContain("Eminem");
    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_CONFIRM_SESSION, PHONE);
  });

  it("'não' → sends cancel confirmation, no insert, session reset", async () => {
    await handleSongConfirm(AWAIT_CONFIRM_SESSION, "não");

    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_CONFIRM_SESSION, PHONE);
    expect(sendTextMock).toHaveBeenCalledWith(PHONE, "Ok, pedido cancelado 🥷");
    expect(insertSongAtNextPositionMock).not.toHaveBeenCalled();
    expect(songRequestCreateMock).not.toHaveBeenCalled();
    expect(evaluateTrackMock).not.toHaveBeenCalled();
  });

  it("'sim' + existing active request → transitions to AWAIT_SWAP_CONFIRM and sends swap prompt with both song names", async () => {
    evaluateTrackMock.mockResolvedValueOnce(ACCEPT_RESULT);
    songRequestFindFirstMock.mockResolvedValueOnce(EXISTING_REQUEST);
    transitionMock.mockResolvedValueOnce({
      ok: true,
      session: { ...AWAIT_CONFIRM_SESSION, state: "AWAIT_SWAP_CONFIRM", version: 3 },
    });

    await handleSongConfirm(AWAIT_CONFIRM_SESSION, "sim");

    expect(transitionMock).toHaveBeenCalledWith(AWAIT_CONFIRM_SESSION, {
      state: "AWAIT_SWAP_CONFIRM",
      pendingSongClassId: CLASS_ID,
      pendingTrackId: TRACK_ID,
      expiresAt: FAKE_EXPIRES,
    });
    expect(sendTextMock).toHaveBeenCalledOnce();
    expect(sendTextMock).toHaveBeenCalledWith(
      PHONE,
      `Já pediste "Rap God — Eminem" para esta aula.\nQueres trocar pela nova (Lose Yourself — Eminem)? (sim/não)`,
    );
    expect(insertSongAtNextPositionMock).not.toHaveBeenCalled();
    expect(songRequestCreateMock).not.toHaveBeenCalled();
    expect(endInteractionMock).not.toHaveBeenCalled();
  });

  it("invalid reply → sends 'Responde sim ou não', stays in state (no reset)", async () => {
    await handleSongConfirm(AWAIT_CONFIRM_SESSION, "talvez");

    expect(sendTextMock).toHaveBeenCalledWith(PHONE, "Responde 'sim' ou 'não'.");
    expect(endInteractionMock).not.toHaveBeenCalled();
    expect(evaluateTrackMock).not.toHaveBeenCalled();
  });
});

describe("handleSwapConfirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ttlFromNowMock.mockReturnValue(FAKE_EXPIRES);
    resetToIdleMock.mockResolvedValue({ ok: true, session: { ...AWAIT_SWAP_SESSION, state: "IDLE" } });
    sendTextMock.mockResolvedValue({ ok: true, status: 200, body: "" });
    swapSongMock.mockResolvedValue({ position: 0, newRequestId: "req-swapped" });
  });

  it("'sim' + existing active request → swapSong called, 'Troca feita!' sent, session reset", async () => {
    songRequestFindFirstMock.mockResolvedValueOnce(EXISTING_REQUEST);
    evaluateTrackMock.mockResolvedValueOnce(ACCEPT_RESULT);

    await handleSwapConfirm(AWAIT_SWAP_SESSION, "sim");

    expect(evaluateTrackMock).toHaveBeenCalledWith(TRACK_ID);
    expect(swapSongMock).toHaveBeenCalledWith({
      oldRequestId: EXISTING_REQUEST.id,
      newTrackUri: ACCEPT_RESULT.trackUri,
      newTrackId: ACCEPT_RESULT.trackId,
      newTrackName: ACCEPT_RESULT.trackName,
      newArtistName: ACCEPT_RESULT.artistName,
      contactId: PHONE,
    });
    expect(sendTextMock.mock.calls[0][0]).toBe(PHONE);
    expect(sendTextMock.mock.calls[0][1]).toContain("Troca feita! 🥷");
    expect(sendTextMock.mock.calls[0][1]).toContain(ACCEPT_RESULT.trackName);
    expect(sendTextMock.mock.calls[0][1]).toContain(ACCEPT_RESULT.artistName);
    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_SWAP_SESSION, PHONE);
  });

  it("'não' → 'Pedido cancelado' sent, session reset, no swap", async () => {
    await handleSwapConfirm(AWAIT_SWAP_SESSION, "não");

    expect(sendTextMock).toHaveBeenCalledWith(PHONE, "Pedido cancelado. Música anterior mantida.");
    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_SWAP_SESSION, PHONE);
    expect(swapSongMock).not.toHaveBeenCalled();
    expect(evaluateTrackMock).not.toHaveBeenCalled();
  });
});

describe("removeSongOnCancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waEventCreateMock.mockResolvedValue({});
    removeSongAndRecompressMock.mockResolvedValue(undefined);
  });

  it("active request exists → removeSongAndRecompress called with the active request's id", async () => {
    const activeRequest = {
      id: "req-active-42",
      contactId: PHONE,
      yogoClassId: CLASS_ID,
      status: "active",
    };
    songRequestFindFirstMock.mockResolvedValueOnce(activeRequest);

    await removeSongOnCancel(PHONE, CLASS_ID);

    expect(songRequestFindFirstMock).toHaveBeenCalledWith({
      where: { contactId: PHONE, yogoClassId: CLASS_ID, status: "active" },
    });
    expect(removeSongAndRecompressMock).toHaveBeenCalledOnce();
    expect(removeSongAndRecompressMock).toHaveBeenCalledWith(activeRequest.id);
    expect(waEventCreateMock).not.toHaveBeenCalled();
  });

  it("no active request → no-op, removeSongAndRecompress not called, no DB error logged", async () => {
    songRequestFindFirstMock.mockResolvedValueOnce(null);

    await removeSongOnCancel(PHONE, CLASS_ID);

    expect(songRequestFindFirstMock).toHaveBeenCalledWith({
      where: { contactId: PHONE, yogoClassId: CLASS_ID, status: "active" },
    });
    expect(removeSongAndRecompressMock).not.toHaveBeenCalled();
    expect(waEventCreateMock).not.toHaveBeenCalled();
  });
});
