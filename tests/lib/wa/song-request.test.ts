import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  sendTextMock,
  sendButtonMock,
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
  sendButtonMock: vi.fn(),
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
  return { ...actual, sendText: sendTextMock, sendButton: sendButtonMock };
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

import {
  offerSongRequest,
  handleSongInput,
  handleSongConfirm,
  handleSwapConfirm,
  removeSongOnCancel,
} from "@/lib/wa/handlers/song-request";

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
    vi.resetAllMocks();
    ttlFromNowMock.mockReturnValue(FAKE_EXPIRES);
  });

  it("no playlist → returns without sending any message", async () => {
    playlistFindUniqueMock.mockResolvedValueOnce(null);

    await offerSongRequest(PHONE, CLASS_ID);

    expect(sendTextMock).not.toHaveBeenCalled();
    expect(sendButtonMock).not.toHaveBeenCalled();
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

    expect(sendButtonMock).not.toHaveBeenCalled();
    expect(loadSessionMock).not.toHaveBeenCalled();
  });

  it("already has active request → skips silently", async () => {
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

    expect(sendButtonMock).not.toHaveBeenCalled();
    expect(loadSessionMock).not.toHaveBeenCalled();
  });

  it("playlist exists, no prior request → sends OFFER button and transitions to AWAIT_SONG_INPUT", async () => {
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
    sendButtonMock.mockResolvedValueOnce({ ok: true, status: 200, body: "" });

    await offerSongRequest(PHONE, CLASS_ID);

    expect(transitionMock).toHaveBeenCalledWith(FAKE_SESSION, {
      state: "AWAIT_SONG_INPUT",
      pendingSongClassId: CLASS_ID,
      expiresAt: FAKE_EXPIRES,
    });
    expect(sendButtonMock).toHaveBeenCalledTimes(1);
    const [recipient, payload] = sendButtonMock.mock.calls[0];
    expect(recipient).toBe(PHONE);
    expect(payload.type).toBe("button");
    expect(payload.bodyText).toContain("pedir uma música");
    const buttonIds = payload.buttons.map((b: { id: string }) => b.id);
    expect(buttonIds).toContain("song_yes");
    expect(buttonIds).toContain("song_no");
    expect(buttonIds).toContain("btn_voltar_menu");
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

    expect(sendButtonMock).not.toHaveBeenCalled();
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
    vi.resetAllMocks();
    ttlFromNowMock.mockReturnValue(FAKE_EXPIRES);
    resetToIdleMock.mockResolvedValue({ ok: true, session: { ...AWAIT_INPUT_SESSION, state: "IDLE" } });
    songRequestCreateMock.mockResolvedValue({});
    sendTextMock.mockResolvedValue({ ok: true, status: 200, body: "" });
    sendButtonMock.mockResolvedValue({ ok: true, status: 200, body: "" });
  });

  it("'não' → ends interaction, no message", async () => {
    await handleSongInput(AWAIT_INPUT_SESSION, "não");

    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_INPUT_SESSION, PHONE);
    expect(sendTextMock).not.toHaveBeenCalled();
    expect(evaluateTrackMock).not.toHaveBeenCalled();
  });

  it("unparseable text → sends button hint with retry + voltar", async () => {
    await handleSongInput(AWAIT_INPUT_SESSION, "alguma coisa aleatória");

    expect(sendButtonMock).toHaveBeenCalledTimes(1);
    const payload = sendButtonMock.mock.calls[0][1];
    expect(payload.bodyText).toContain("link Spotify");
    const ids = payload.buttons.map((b: { id: string }) => b.id);
    expect(ids).toContain("btn_voltar_menu");
    expect(endInteractionMock).not.toHaveBeenCalled();
    expect(evaluateTrackMock).not.toHaveBeenCalled();
  });

  it("locked playlist → rejected_window record, message, endInteraction", async () => {
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

  it("genre rejection → rejected_genre record + message + endInteraction", async () => {
    playlistFindUniqueMock.mockResolvedValueOnce(OPEN_PLAYLIST);
    evaluateTrackMock.mockResolvedValueOnce({
      outcome: "reject_genre",
      matchedKeyword: "sertanejo",
      matchedAgainst: "genre",
      trackName: "Amor Proibido",
      artistName: "Gusttavo Lima",
    });

    await handleSongInput(AWAIT_INPUT_SESSION, SPOTIFY_LINK);

    expect(evaluateTrackMock).toHaveBeenCalledWith(TRACK_ID);
    expect(songRequestCreateMock).toHaveBeenCalledOnce();
    expect(sendTextMock).toHaveBeenCalledWith(
      PHONE,
      "Esta música é classificada como sertanejo pelo Spotify. A casa só toca rock, hip-hop, rap e pop. Tenta outra 🥷",
    );
    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_INPUT_SESSION, PHONE);
  });

  it("evaluateTrack throws → logs SONG_EVAL_FAIL, user-visible message, endInteraction (no silent failure)", async () => {
    playlistFindUniqueMock.mockResolvedValueOnce(OPEN_PLAYLIST);
    evaluateTrackMock.mockRejectedValueOnce(new Error("Track lookup failed: 403"));
    waEventCreateMock.mockResolvedValue({});

    await handleSongInput(AWAIT_INPUT_SESSION, SPOTIFY_LINK);

    expect(waEventCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "SONG_EVAL_FAIL" }) }),
    );
    expect(sendTextMock).toHaveBeenCalledWith(
      PHONE,
      expect.stringContaining("Não consegui verificar"),
    );
    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_INPUT_SESSION, PHONE);
  });

  it("accepted track → transitions to AWAIT_SONG_CONFIRM and sends confirm BUTTON", async () => {
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
    expect(sendButtonMock).toHaveBeenCalledOnce();
    const payload = sendButtonMock.mock.calls[0][1];
    expect(payload.bodyText).toContain("Lose Yourself");
    expect(payload.bodyText).toContain("Eminem");
    const ids = payload.buttons.map((b: { id: string }) => b.id);
    expect(ids).toContain("song_confirm");
    expect(ids).toContain("song_cancel");
    expect(ids).toContain("btn_voltar_menu");
    expect(endInteractionMock).not.toHaveBeenCalled();
  });
});

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
    vi.resetAllMocks();
    ttlFromNowMock.mockReturnValue(FAKE_EXPIRES);
    resetToIdleMock.mockResolvedValue({ ok: true, session: { ...AWAIT_CONFIRM_SESSION, state: "IDLE" } });
    sendTextMock.mockResolvedValue({ ok: true, status: 200, body: "" });
    sendButtonMock.mockResolvedValue({ ok: true, status: 200, body: "" });
    songRequestCreateMock.mockResolvedValue({ id: "req-new" });
    insertSongAtNextPositionMock.mockResolvedValue({ position: 0 });
  });

  it("'song_confirm' + no existing request → insertSongAtNextPosition called, record created, message says '1ª posição'", async () => {
    evaluateTrackMock.mockResolvedValueOnce(ACCEPT_RESULT);
    songRequestFindFirstMock.mockResolvedValueOnce(null);
    playlistFindUniqueMock.mockResolvedValueOnce({ ...OPEN_PLAYLIST, requestCount: 1 });

    await handleSongConfirm(AWAIT_CONFIRM_SESSION, "song_confirm");

    expect(evaluateTrackMock).toHaveBeenCalledWith(TRACK_ID);
    expect(insertSongAtNextPositionMock).toHaveBeenCalledWith({
      yogoClassId: CLASS_ID,
      trackUri: ACCEPT_RESULT.trackUri,
    });
    expect(songRequestCreateMock).toHaveBeenCalledOnce();
    expect(songRequestCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: PHONE,
        spotifyTrackId: TRACK_ID,
        status: "active",
        position: 0,
      }),
    });
    expect(sendTextMock.mock.calls[0][1]).toContain("Adicionado! 🥷");
    expect(sendTextMock.mock.calls[0][1]).toContain("1ª posição");
    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_CONFIRM_SESSION, PHONE);
  });

  it("'song_cancel' → endInteraction, no insert, no evaluate", async () => {
    await handleSongConfirm(AWAIT_CONFIRM_SESSION, "song_cancel");

    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_CONFIRM_SESSION, PHONE);
    expect(insertSongAtNextPositionMock).not.toHaveBeenCalled();
    expect(songRequestCreateMock).not.toHaveBeenCalled();
    expect(evaluateTrackMock).not.toHaveBeenCalled();
  });

  it("'song_confirm' + existing active request → transitions to AWAIT_SWAP_CONFIRM, sends replace BUTTON", async () => {
    evaluateTrackMock.mockResolvedValueOnce(ACCEPT_RESULT);
    songRequestFindFirstMock.mockResolvedValueOnce(EXISTING_REQUEST);
    transitionMock.mockResolvedValueOnce({
      ok: true,
      session: { ...AWAIT_CONFIRM_SESSION, state: "AWAIT_SWAP_CONFIRM", version: 3 },
    });

    await handleSongConfirm(AWAIT_CONFIRM_SESSION, "song_confirm");

    expect(transitionMock).toHaveBeenCalledWith(AWAIT_CONFIRM_SESSION, {
      state: "AWAIT_SWAP_CONFIRM",
      pendingSongClassId: CLASS_ID,
      pendingTrackId: TRACK_ID,
      expiresAt: FAKE_EXPIRES,
    });
    expect(sendButtonMock).toHaveBeenCalledOnce();
    const payload = sendButtonMock.mock.calls[0][1];
    expect(payload.bodyText).toContain("Rap God");
    expect(payload.bodyText).toContain("Lose Yourself");
    const ids = payload.buttons.map((b: { id: string }) => b.id);
    expect(ids).toContain("replace_yes");
    expect(ids).toContain("replace_no");
    expect(ids).toContain("btn_voltar_menu");
    expect(insertSongAtNextPositionMock).not.toHaveBeenCalled();
  });

  it("evaluateTrack throws on confirm → SONG_EVAL_FAIL logged + user-visible message", async () => {
    evaluateTrackMock.mockRejectedValueOnce(new Error("Track lookup failed: 403"));
    waEventCreateMock.mockResolvedValue({});

    await handleSongConfirm(AWAIT_CONFIRM_SESSION, "song_confirm");

    expect(waEventCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "SONG_EVAL_FAIL" }) }),
    );
    expect(sendTextMock).toHaveBeenCalledWith(PHONE, expect.stringContaining("Falhou"));
    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_CONFIRM_SESSION, PHONE);
  });
});

describe("handleSwapConfirm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ttlFromNowMock.mockReturnValue(FAKE_EXPIRES);
    resetToIdleMock.mockResolvedValue({ ok: true, session: { ...AWAIT_SWAP_SESSION, state: "IDLE" } });
    sendTextMock.mockResolvedValue({ ok: true, status: 200, body: "" });
    sendButtonMock.mockResolvedValue({ ok: true, status: 200, body: "" });
    swapSongMock.mockResolvedValue({ position: 0, newRequestId: "req-swapped" });
  });

  it("'replace_yes' + existing active request → swapSong called, 'Trocada!' sent, endInteraction", async () => {
    songRequestFindFirstMock.mockResolvedValueOnce(EXISTING_REQUEST);
    evaluateTrackMock.mockResolvedValueOnce(ACCEPT_RESULT);

    await handleSwapConfirm(AWAIT_SWAP_SESSION, "replace_yes");

    expect(evaluateTrackMock).toHaveBeenCalledWith(TRACK_ID);
    expect(swapSongMock).toHaveBeenCalledWith({
      oldRequestId: EXISTING_REQUEST.id,
      newTrackUri: ACCEPT_RESULT.trackUri,
      newTrackId: ACCEPT_RESULT.trackId,
      newTrackName: ACCEPT_RESULT.trackName,
      newArtistName: ACCEPT_RESULT.artistName,
      contactId: PHONE,
    });
    expect(sendTextMock.mock.calls[0][1]).toContain("Trocada!");
    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_SWAP_SESSION, PHONE);
  });

  it("'replace_no' → 'Mantida' sent, endInteraction, no swap", async () => {
    await handleSwapConfirm(AWAIT_SWAP_SESSION, "replace_no");

    expect(sendTextMock).toHaveBeenCalledWith(PHONE, expect.stringContaining("Mantida"));
    expect(endInteractionMock).toHaveBeenCalledWith(AWAIT_SWAP_SESSION, PHONE);
    expect(swapSongMock).not.toHaveBeenCalled();
    expect(evaluateTrackMock).not.toHaveBeenCalled();
  });
});

describe("removeSongOnCancel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    waEventCreateMock.mockResolvedValue({});
    removeSongAndRecompressMock.mockResolvedValue(undefined);
  });

  it("active request exists → removeSongAndRecompress called", async () => {
    const activeRequest = {
      id: "req-active-42",
      contactId: PHONE,
      yogoClassId: CLASS_ID,
      status: "active",
    };
    songRequestFindFirstMock.mockResolvedValueOnce(activeRequest);

    await removeSongOnCancel(PHONE, CLASS_ID);

    expect(removeSongAndRecompressMock).toHaveBeenCalledOnce();
    expect(removeSongAndRecompressMock).toHaveBeenCalledWith(activeRequest.id);
    expect(waEventCreateMock).not.toHaveBeenCalled();
  });

  it("no active request → no-op", async () => {
    songRequestFindFirstMock.mockResolvedValueOnce(null);

    await removeSongOnCancel(PHONE, CLASS_ID);

    expect(removeSongAndRecompressMock).not.toHaveBeenCalled();
    expect(waEventCreateMock).not.toHaveBeenCalled();
  });
});
