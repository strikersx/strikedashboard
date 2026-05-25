import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { readRawBody } from "@/lib/wa/raw-body";
import { verifySignature } from "@/lib/wa/verify";
import { sendText } from "@/lib/wa/meta";

const SIGNATURE_HEADER = "x-hub-signature-256";

interface MetaMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
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
//   1. Read raw body once (HMAC needs the exact bytes)
//   2. Verify HMAC → 401 + WaEvent HMAC_FAIL on mismatch
//   3. Upsert each message to WaInbound (metaId @unique catches dedupe)
//   4. Return 200
//   5. after() — echo each new message back via sendText
export async function POST(req: NextRequest) {
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

  const newMessages: Array<{ metaId: string; phoneE164: string; body: string }> = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        if (!msg.id || !msg.from) continue;
        const phoneE164 = msg.from.startsWith("+") ? msg.from : `+${msg.from}`;
        const body = msg.type === "text" ? (msg.text?.body ?? "") : `[unsupported ${msg.type ?? "unknown"}]`;
        const stored = await storeInbound({ metaId: msg.id, phoneE164, body });
        if (stored) newMessages.push({ metaId: msg.id, phoneE164, body });
      }
    }
  }

  if (newMessages.length > 0) {
    after(async () => {
      for (const m of newMessages) {
        try {
          await sendText(m.phoneE164, `echo: ${m.body}`);
        } catch {
          // Errors here surface in Vercel logs; nothing user-facing.
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
