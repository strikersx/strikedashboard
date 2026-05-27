// Parses a Meta inbound message into a structural intent. Keyword matching is
// accent-insensitive and trims punctuation so "reserva!", "RESERVA", "Reserva."
// all map to the same intent. Interactive replies bypass keyword matching --
// their button/list reply id is what we sent.

export type Intent =
  | { kind: "reservar" }
  | { kind: "cancelar" }
  | { kind: "list_pick"; id: string }
  | { kind: "button"; id: string }
  | { kind: "text"; body: string };

export interface MetaInboundMessage {
  type?: string;
  text?: { body?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string };
    list_reply?: { id?: string };
  };
}

const RESERVAR_RE = /^(reserva|reservar|marcar|agendar)$/i;
const CANCELAR_RE = /^(cancelar|cancela|desmarcar)$/i;

export function parseIntent(msg: MetaInboundMessage): Intent {
  if (msg.type === "interactive" && msg.interactive) {
    const listId = msg.interactive.list_reply?.id;
    if (listId) return { kind: "list_pick", id: listId };
    const btnId = msg.interactive.button_reply?.id;
    if (btnId) return { kind: "button", id: btnId };
  }

  const raw = msg.text?.body ?? "";
  const normalised = stripDiacritics(raw).trim().replace(/[.,;:!?¿¡]+$/g, "").toLowerCase();

  if (RESERVAR_RE.test(normalised)) return { kind: "reservar" };
  if (CANCELAR_RE.test(normalised)) return { kind: "cancelar" };
  return { kind: "text", body: raw };
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Free-text DD/MM HH:MM fallback for cancelar when the user has too many
// signups for an interactive list. Accepts "25/05 19:30", "25/5 19h30",
// "25-05 19h30". Returns { day, month, hour, minute } or null.
const DATE_TIME_RE = /^\s*(\d{1,2})[/-](\d{1,2})\s+(\d{1,2})[h:](\d{2})\s*$/;

export interface DateTimeParts {
  day: number;
  month: number;
  hour: number;
  minute: number;
}

export function parseDateTime(input: string): DateTimeParts | null {
  const m = input.match(DATE_TIME_RE);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const hour = Number(m[3]);
  const minute = Number(m[4]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { day, month, hour, minute };
}

const SPOTIFY_TRACK_URL_RE = /https?:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]+)/;
const SPOTIFY_TRACK_URI_RE = /spotify:track:([a-zA-Z0-9]+)/;

export function parseSpotifyTrackId(input: string): string | null {
  if (!input) return null;
  const urlMatch = input.match(SPOTIFY_TRACK_URL_RE);
  if (urlMatch) return urlMatch[1];
  const uriMatch = input.match(SPOTIFY_TRACK_URI_RE);
  if (uriMatch) return uriMatch[1];
  return null;
}
