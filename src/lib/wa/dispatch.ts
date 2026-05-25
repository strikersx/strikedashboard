import { isReservarEnabled, isCancelarEnabled } from "@/lib/wa/config";
import { parseIntent, type MetaInboundMessage } from "@/lib/wa/parser";
import { isExpired, loadSession, resetToIdle } from "@/lib/wa/session";
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
import { handleFallback } from "@/lib/wa/handlers/fallback";

// Dispatch routes an inbound message based on the session's current state.
// "reserva" and "cancelar" keywords always reset state (per spec) so a stuck
// user can re-enter the funnel by just typing the keyword again.
export async function dispatch(phoneE164: string, message: MetaInboundMessage): Promise<void> {
  if (!isReservarEnabled()) {
    // Reservar flow disabled -> behave like Slice 2 echo so we don't break
    // existing demos while the flag is off.
    const body = message.text?.body ?? "";
    await sendText(phoneE164, `echo: ${body}`);
    return;
  }

  const intent = parseIntent(message);
  let session = await loadSession(phoneE164);
  if (isExpired(session)) {
    const reset = await resetToIdle(session);
    if (reset.ok) session = reset.session;
  }

  // Universal keywords always reset and re-enter the flow.
  if (intent.kind === "reservar") {
    if (session.state !== "IDLE") {
      const reset = await resetToIdle(session);
      if (reset.ok) session = reset.session;
    }
    await handleReservar(session);
    return;
  }
  if (intent.kind === "cancelar") {
    if (!isCancelarEnabled()) {
      await sendText(phoneE164, "Cancelar ainda não está activo. Por agora, escreve ao Marcelo.");
      return;
    }
    if (session.state !== "IDLE") {
      const reset = await resetToIdle(session);
      if (reset.ok) session = reset.session;
    }
    await handleCancelar(session);
    return;
  }

  switch (session.state) {
    case "AWAIT_CLASS_PICK":
      if (intent.kind === "list_pick") return handleClassPick(session, intent.id);
      return handleFallback(phoneE164);

    case "AWAIT_CONFIRM_BOOK":
      if (intent.kind === "button" && intent.id === "confirm_book") return handleConfirmBook(session);
      if (intent.kind === "button" && intent.id === "cancel_book") return handleCancelBook(session);
      return handleFallback(phoneE164);

    case "AWAIT_CANCEL_PICK":
      if (intent.kind === "list_pick") return handleCancelPick(session, intent.id);
      if (intent.kind === "text") return handleCancelPickByText(session, intent.body);
      return handleFallback(phoneE164);

    case "AWAIT_CONFIRM_CANCEL":
      if (intent.kind === "button" && intent.id === "confirm_cancel") return handleConfirmCancel(session);
      if (intent.kind === "button" && intent.id === "abort_cancel") return handleAbortCancel(session);
      return handleFallback(phoneE164);

    case "IDLE":
    default:
      return handleFallback(phoneE164);
  }
}
