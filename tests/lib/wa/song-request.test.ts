import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock variables are available when vi.mock factory runs (hoisted to top)
const {
  sendTextMock,
  loadSessionMock,
  transitionMock,
  ttlFromNowMock,
  playlistFindUniqueMock,
  songRequestFindFirstMock,
} = vi.hoisted(() => ({
  sendTextMock: vi.fn(),
  loadSessionMock: vi.fn(),
  transitionMock: vi.fn(),
  ttlFromNowMock: vi.fn(),
  playlistFindUniqueMock: vi.fn(),
  songRequestFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const dbMock = {
    waClassPlaylist: {
      findUnique: playlistFindUniqueMock,
    },
    waSongRequest: {
      findFirst: songRequestFindFirstMock,
    },
  };
  return { db: dbMock };
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
  };
});

import { offerSongRequest } from "@/lib/wa/handlers/song-request";

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
