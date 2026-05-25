import { db } from "@/lib/db";
import { findCustomerByPhone } from "@/lib/yogo/lookup";
import {
  deleteSignup,
  isCancellable,
  listFutureSignups,
  parseClassStart,
  type YogoSignup,
} from "@/lib/yogo/signups";
import { sendText, sendButton, sendList } from "@/lib/wa/meta";
import {
  renderCancelList,
  renderConfirmCancel,
  type SignupLite,
  type YogoClassLite,
} from "@/lib/wa/render";
import { parseDateTime } from "@/lib/wa/parser";
import { resetToIdle, transition, ttlFromNow, type SessionRow } from "@/lib/wa/session";

const NO_PLAN_LOOKUP = "Não te encontrámos no sistema. Escreve directamente ao Marcelo.";
const NO_SIGNUPS = "Não tens marcações canceláveis (cutoff 15min antes da aula).";
const CANCELLED_OK = "Cancelado.";
const ERR_NOT_FOUND = "Aula já não está disponível para cancelar.";
const ERR_SERVER = "Sistema temporariamente indisponível. Tenta outra vez em 1min.";
const ERR_RACE = "Outra mensagem cruzou-se com esta. Diz cancelar para começar de novo.";

const FUTURE_LOOKAHEAD_DAYS = 14;

export async function handleCancelar(session: SessionRow): Promise<void> {
  const phoneE164 = session.phoneE164;
  const customer = await findCustomerByPhone(phoneE164);
  if (!customer) {
    await db.waEvent.create({ data: { kind: "LOOKUP_MISS", phoneE164 } });
    await sendText(phoneE164, NO_PLAN_LOOKUP);
    return;
  }

  const from = isoDate(0);
  const to = isoDate(FUTURE_LOOKAHEAD_DAYS);
  const all = await listFutureSignups(customer.id, from, to);
  const cancellable = all.filter((s) => isCancellable(s)).map(toSignupLite);

  if (cancellable.length === 0) {
    await sendText(phoneE164, NO_SIGNUPS);
    return;
  }

  // N=1: still ask for confirm (spec: mandatory even for single signup).
  if (cancellable.length === 1) {
    const t = await transition(session, {
      state: "AWAIT_CONFIRM_CANCEL",
      pendingSignupId: cancellable[0].id,
      expiresAt: ttlFromNow(),
    });
    if (!t.ok) {
      await db.waEvent.create({ data: { kind: "SESSION_RACE", phoneE164 } });
      return;
    }
    await sendButton(phoneE164, renderConfirmCancel(cancellable[0]));
    return;
  }

  // N=2..20: interactive list.
  // N>20: free-text DD/MM HH:MM fallback.
  const payload = renderCancelList(cancellable);
  if (payload.type === "text") {
    const t = await transition(session, {
      state: "AWAIT_CANCEL_PICK",
      pendingSignupId: null,
      expiresAt: ttlFromNow(),
    });
    if (!t.ok) {
      await db.waEvent.create({ data: { kind: "SESSION_RACE", phoneE164 } });
      return;
    }
    await sendText(phoneE164, payload.body);
    return;
  }

  const t = await transition(session, {
    state: "AWAIT_CANCEL_PICK",
    pendingSignupId: null,
    expiresAt: ttlFromNow(),
  });
  if (!t.ok) {
    await db.waEvent.create({ data: { kind: "SESSION_RACE", phoneE164 } });
    return;
  }
  await sendList(phoneE164, payload);
}

export async function handleCancelPick(session: SessionRow, signupIdRaw: string): Promise<void> {
  const signupId = Number(signupIdRaw);
  if (!Number.isFinite(signupId)) {
    await sendText(session.phoneE164, "Selecção inválida. Diz cancelar para começar de novo.");
    return;
  }

  const customer = await findCustomerByPhone(session.phoneE164);
  if (!customer) {
    await db.waEvent.create({ data: { kind: "LOOKUP_MISS", phoneE164: session.phoneE164 } });
    await sendText(session.phoneE164, NO_PLAN_LOOKUP);
    await resetToIdle(session);
    return;
  }

  const all = await listFutureSignups(customer.id, isoDate(0), isoDate(FUTURE_LOOKAHEAD_DAYS));
  const target = all.find((s) => s.id === signupId && isCancellable(s));
  if (!target) {
    await sendText(session.phoneE164, ERR_NOT_FOUND);
    await resetToIdle(session);
    return;
  }

  const t = await transition(session, {
    state: "AWAIT_CONFIRM_CANCEL",
    pendingSignupId: signupId,
    expiresAt: ttlFromNow(),
  });
  if (!t.ok) {
    await db.waEvent.create({ data: { kind: "SESSION_RACE", phoneE164: session.phoneE164 } });
    return;
  }

  await sendButton(session.phoneE164, renderConfirmCancel(toSignupLite(target)));
}

export async function handleCancelPickByText(session: SessionRow, text: string): Promise<void> {
  const parsed = parseDateTime(text);
  if (!parsed) {
    await sendText(
      session.phoneE164,
      "Formato inválido. Escreve a data e hora como 25/05 19:30.",
    );
    return;
  }
  const customer = await findCustomerByPhone(session.phoneE164);
  if (!customer) {
    await db.waEvent.create({ data: { kind: "LOOKUP_MISS", phoneE164: session.phoneE164 } });
    await sendText(session.phoneE164, NO_PLAN_LOOKUP);
    await resetToIdle(session);
    return;
  }
  const all = await listFutureSignups(customer.id, isoDate(0), isoDate(FUTURE_LOOKAHEAD_DAYS));
  const match = all.find((s) => {
    if (!isCancellable(s)) return false;
    const klass = typeof s.class === "object" ? s.class : null;
    const start = parseClassStart(klass);
    if (!start) return false;
    return (
      start.getDate() === parsed.day &&
      start.getMonth() + 1 === parsed.month &&
      start.getHours() === parsed.hour &&
      start.getMinutes() === parsed.minute
    );
  });
  if (!match) {
    await sendText(session.phoneE164, "Não encontrei nenhuma marcação para essa data.");
    return;
  }
  const t = await transition(session, {
    state: "AWAIT_CONFIRM_CANCEL",
    pendingSignupId: match.id,
    expiresAt: ttlFromNow(),
  });
  if (!t.ok) {
    await db.waEvent.create({ data: { kind: "SESSION_RACE", phoneE164: session.phoneE164 } });
    return;
  }
  await sendButton(session.phoneE164, renderConfirmCancel(toSignupLite(match)));
}

export async function handleConfirmCancel(session: SessionRow): Promise<void> {
  const phoneE164 = session.phoneE164;
  if (!session.pendingSignupId) {
    await sendText(phoneE164, ERR_RACE);
    await resetToIdle(session);
    return;
  }
  const result = await deleteSignup(session.pendingSignupId);
  if (result.kind === "ok") {
    await db.waEvent.create({ data: { kind: "CANCEL_OK", phoneE164 } });
    await sendText(phoneE164, CANCELLED_OK);
  } else if (result.kind === "not_found") {
    await db.waEvent.create({
      data: { kind: "CANCEL_FAIL", phoneE164, meta: JSON.stringify({ subkind: "not_found" }) },
    });
    await sendText(phoneE164, ERR_NOT_FOUND);
  } else {
    await db.waEvent.create({
      data: { kind: "CANCEL_FAIL", phoneE164, meta: JSON.stringify({ status: result.status }) },
    });
    await sendText(phoneE164, ERR_SERVER);
  }
  await resetToIdle(session);
}

export async function handleAbortCancel(session: SessionRow): Promise<void> {
  await sendText(session.phoneE164, "Ok, mantenho a marcação.");
  await resetToIdle(session);
}

function toSignupLite(s: YogoSignup): SignupLite {
  const klass = (typeof s.class === "object" ? s.class : { id: 0, date: "", start_time: "" }) as YogoClassLite;
  return { id: s.id, klass };
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
