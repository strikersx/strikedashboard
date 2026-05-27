import { describe, it, expect } from "vitest";
import { parseSpotifyTrackId } from "@/lib/wa/parser";

describe("parseSpotifyTrackId", () => {
  it("extracts ID from open.spotify.com track URL", () => {
    expect(parseSpotifyTrackId("https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv"))
      .toBe("4u7EnebtmKWzUH433cf5Qv");
  });

  it("extracts ID from open.spotify.com URL with si= query", () => {
    expect(
      parseSpotifyTrackId(
        "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv?si=abc123"
      )
    ).toBe("4u7EnebtmKWzUH433cf5Qv");
  });

  it("extracts ID from open.spotify.com URL with locale prefix", () => {
    expect(
      parseSpotifyTrackId("https://open.spotify.com/intl-pt/track/4u7EnebtmKWzUH433cf5Qv")
    ).toBe("4u7EnebtmKWzUH433cf5Qv");
  });

  it("extracts ID from spotify URI", () => {
    expect(parseSpotifyTrackId("spotify:track:4u7EnebtmKWzUH433cf5Qv"))
      .toBe("4u7EnebtmKWzUH433cf5Qv");
  });

  it("returns null for non-track URLs (album, playlist)", () => {
    expect(parseSpotifyTrackId("https://open.spotify.com/album/abc")).toBeNull();
    expect(parseSpotifyTrackId("https://open.spotify.com/playlist/abc")).toBeNull();
  });

  it("returns null for free text", () => {
    expect(parseSpotifyTrackId("Bohemian Rhapsody")).toBeNull();
    expect(parseSpotifyTrackId("")).toBeNull();
  });

  it("finds Spotify link inside surrounding text", () => {
    expect(
      parseSpotifyTrackId("tira esta https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv ya")
    ).toBe("4u7EnebtmKWzUH433cf5Qv");
  });
});
