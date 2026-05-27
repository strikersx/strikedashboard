import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock variables are available when vi.mock factory runs (hoisted to top)
const {
  sendTextMock,
  loadSessionMock,
  transitionMock,
  ttlFromNowMock,
  resetToIdleMock,
  playlistFindUniqueMock,
  songRequestFindFirstMock,
  songRequestCreateMock,
  evaluateTrackMock,
} = vi.hoisted(() => ({
  sendTextMock: vi.fn(),
  loadSessionMock: vi.fn(),
  transitionMock: vi.fn(),
  ttlFromNowMock: vi.fn(),
  resetToIdleMock: vi.fn(),
  playlistFindUniqueMock: vi.fn(),
  songRequestFindFirstMock: vi.fn(),
  songRequestCreateMock: vi.fn(),
  evaluateTrackMock: vi.fn(),
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
  };
  return { db: dbMock };
});

vi.mock("@/lib/spotify/genre-filter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/spotify/genre-filter")>();
  return { ...actual, evaluateTrack: evaluateTrackMock };
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

import { offerSongRequest, handleSongInput } from "@/lib/wa/handlers/song-request";

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

    expect(resetToIdleMock).toHaveBeenCalledWith(AWAIT_INPUT_SESSION);
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
    expect(resetToIdleMock).not.toHaveBeenCalled();
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
    expect(resetToIdleMock).toHaveBeenCalledWith(AWAIT_INPUT_SESSION);
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
    expect(resetToIdleMock).toHaveBeenCalledWith(AWAIT_INPUT_SESSION);
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
      "Vais ouvir Lose Yourself — Eminem 🎵\nConfirmar? (sim/não)",
    );
    expect(resetToIdleMock).not.toHaveBeenCalled();
    expect(songRequestCreateMock).not.toHaveBeenCalled();
  });
});
