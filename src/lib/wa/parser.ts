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
