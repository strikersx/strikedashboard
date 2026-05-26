import { db } from "@/lib/db";
import { isReservarEnabled } from "@/lib/wa/config";
import { parseIntent, type MetaInboundMessage } from "@/lib/wa/parser";
import { isExpired, loadSession, resetToIdle, type SessionRow } from "@/lib/wa/session";
import { sendText } from "@/lib/wa/meta";
import {
  handleClassPick,
  handleConfirmBook,
  handleCancelBook,
  handleReservar,
} from "@/lib/wa/handlers/reservar";
import {
  handleAbortCancel,
  handleCancelPick,
  handleCancelPickByText,
  handleCancelar,
  handleConfirmCancel,
} from "@/lib/wa/handlers/cancelar";
import { handleOutros, sendMenu } from "@/lib/wa/handlers/menu";

// Dispatch routes an inbound WhatsApp message based on (1) menu button IDs,
// (2) the session's current state, and (3) the intent kind from the parser.
//
// Top-of-funnel UX: any text in IDLE shows the menu (Reservar / Minha agenda
// / Outros). The 3 button replies fire the corresponding flows from anywhere
// (state is reset first). Mid-flow text resets to IDLE and re-shows the menu
// — there is no contextual text fallback anymore.
export async function dispatch(phoneE164: string, message: MetaInboundMessage): Promise<void> {
  if (!isReservarEnabled()) {
    // Slice-2 echo retained for emergency rollback. Should not be reached
    // once WA_FLOW_RESERVAR=true in prod.
    const body = message.text?.body ?? "";
    const result = await sendText(phoneE164, `echo: ${body}`);
    if (!result.ok) {
      await db.waEvent
        .create({
          data: {
            kind: "SEND_FAIL",
            phoneE164,
            meta: JSON.stringify({ status: result.status, body: result.body.slice(0, 300) }),
          },
        })
        .catch(() => undefined);
    }
    return;
  }

  const intent = parseIntent(message);
  let session = await loadSession(phoneE164);
  if (isExpired(session)) {
    const reset = await resetToIdle(session);
    if (reset.ok) session = reset.session;
  }

  // Menu buttons are the universal "start over" signal. Reset state first
  // so the handler runs in a clean IDLE-equivalent.
  if (intent.kind === "button") {
    if (intent.id === "btn_reservar") {
      session = await ensureIdle(session);
      return handleReservar(session);
    }
    if (intent.id === "btn_agenda") {
      session = await ensureIdle(session);
      return handleCancelar(session);
    }
    if (intent.id === "btn_outros") {
      session = await ensureIdle(session);
      return handleOutros(phoneE164);
    }
    // Otherwise fall through to flow-specific button routing below.
  }

  switch (session.state) {
    case "AWAIT_CLASS_PICK":
      if (intent.kind === "list_pick") return handleClassPick(session, intent.id);
      if (intent.kind === "button" && intent.id === "confirm_book") return handleConfirmBook(session);
      if (intent.kind === "button" && intent.id === "cancel_book") return handleCancelBook(session);
      // Any text or other input → reset and re-show menu.
      await resetToIdle(session);
      return sendMenu(phoneE164);

    case "AWAIT_CONFIRM_BOOK":
      if (intent.kind === "button" && intent.id === "confirm_book") return handleConfirmBook(session);
      if (intent.kind === "button" && intent.id === "cancel_book") return handleCancelBook(session);
      await resetToIdle(session);
      return sendMenu(phoneE164);

    case "AWAIT_CANCEL_PICK":
      if (intent.kind === "list_pick") return handleCancelPick(session, intent.id);
      // Free-text DD/MM HH:MM is the documented fallback when there are >10
      // signups, so we keep it routed here.
      if (intent.kind === "text") return handleCancelPickByText(session, intent.body);
      await resetToIdle(session);
      return sendMenu(phoneE164);

    case "AWAIT_CONFIRM_CANCEL":
      if (intent.kind === "button" && intent.id === "confirm_cancel") return handleConfirmCancel(session);
      if (intent.kind === "button" && intent.id === "abort_cancel") return handleAbortCancel(session);
      await resetToIdle(session);
      return sendMenu(phoneE164);

    case "IDLE":
    default:
      // Anything in IDLE → menu. Keywords ('reserva', 'cancelar') hit this
      // branch too because parseIntent still classifies them as text-like
      // intents, but we deliberately ignore the kind here.
      return sendMenu(phoneE164);
  }
}

async function ensureIdle(session: SessionRow): Promise<SessionRow> {
  if (session.state === "IDLE") return session;
  const reset = await resetToIdle(session);
  return reset.ok ? reset.session : session;
}
