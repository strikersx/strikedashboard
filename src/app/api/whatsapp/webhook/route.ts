import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { readRawBody } from "@/lib/wa/raw-body";
import { verifySignature } from "@/lib/wa/verify";
import { isWaEnabled } from "@/lib/wa/config";
import { dispatch } from "@/lib/wa/dispatch";
import type { MetaInboundMessage } from "@/lib/wa/parser";

const SIGNATURE_HEADER = "x-hub-signature-256";

interface MetaMessage extends MetaInboundMessage {
  id?: string;
  from?: string;
}

interface MetaChange {
  value?: { messages?: MetaMessage[] };
  field?: string;
}

interface MetaPayload {
  object?: string;
  entry?: Array<{ changes?: MetaChange[] }>;
}

// GET — Meta verification handshake.
// https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WA_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

// POST — inbound message. Must respond <50ms or Meta retries aggressively.
//   0. Kill switch (WA_ENABLED=false) → 200 ack-only, no processing
//   1. Read raw body once (HMAC needs the exact bytes)
//   2. Verify HMAC → 401 + WaEvent HMAC_FAIL on mismatch
//   3. Upsert each message to WaInbound (metaId @unique catches dedupe)
//   4. Return 200
//   5. after() — echo each new message back via sendText
export async function POST(req: NextRequest) {
  if (!isWaEnabled()) {
    return NextResponse.json({ ack: true, disabled: true });
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers.get(SIGNATURE_HEADER);
  const appSecret = process.env.WA_APP_SECRET ?? "";

  if (!verifySignature(rawBody, signature, appSecret)) {
    await db.waEvent.create({ data: { kind: "HMAC_FAIL" } }).catch(() => undefined);
    return new Response("invalid signature", { status: 401 });
  }

  let payload: MetaPayload;
  try {
    payload = JSON.parse(rawBody) as MetaPayload;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const toDispatch: Array<{ phoneE164: string; msg: MetaMessage }> = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        if (!msg.id || !msg.from) continue;
        const phoneE164 = msg.from.startsWith("+") ? msg.from : `+${msg.from}`;
        const body =
          msg.type === "text"
            ? (msg.text?.body ?? "")
            : JSON.stringify({ type: msg.type, interactive: msg.interactive });
        const stored = await storeInbound({ metaId: msg.id, phoneE164, body });
        if (stored) toDispatch.push({ phoneE164, msg });
      }
    }
  }

  if (toDispatch.length > 0) {
    after(async () => {
      for (const item of toDispatch) {
        try {
          await dispatch(item.phoneE164, item.msg);
        } catch (err) {
          // Surface in WaEvent so a runbook query can find dispatch failures
          // without having to grep Vercel logs.
          const message = err instanceof Error ? err.message : String(err);
          await db.waEvent
            .create({
              data: {
                kind: "DISPATCH_FAIL",
                phoneE164: item.phoneE164,
                meta: JSON.stringify({ error: message.slice(0, 500) }),
              },
            })
            .catch(() => undefined);
        }
      }
    });
  }

  return NextResponse.json({ received: payload.entry?.length ?? 0 });
}

// Returns true when the row was actually inserted (i.e. NOT a Meta retry).
async function storeInbound(row: { metaId: string; phoneE164: string; body: string }): Promise<boolean> {
  try {
    await db.waContact.upsert({
      where: { phoneE164: row.phoneE164 },
      create: { phoneE164: row.phoneE164 },
      update: {},
    });
    await db.waInbound.create({ data: row });
    return true;
  } catch (err: unknown) {
    // P2002 = unique constraint violation on metaId → Meta retried a delivered message.
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return false;
    }
    throw err;
  }
}
