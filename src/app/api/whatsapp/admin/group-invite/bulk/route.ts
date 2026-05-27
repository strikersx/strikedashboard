import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalize } from "@/lib/phone";
import { fetchAllYogoCustomers } from "@/lib/yogo/recurring-subs";
import {
  formatInviteParams,
  idempotencyAllows,
  summarizeDetails,
  type SendDetail,
} from "@/lib/wa/group-invite";
import { sendTemplate } from "@/lib/wa/meta";

const TEMPLATE_KEY = "grp_invite";
const TEMPLATE_NAME = "convite_grupo_whatsapp";
const LANGUAGE_CODE = "pt_PT";
const PER_REQUEST_GAP_MS = 200;

interface BulkRequest {
  phoneE164s: unknown;
  force?: unknown;
  dryRun?: unknown;
}

// POST /api/whatsapp/admin/group-invite/bulk
// Admin-only. Sends the Meta-approved template "convite_grupo_whatsapp" to the
// supplied phones. Skips anyone invited in the last 30 days unless force=true.
// dryRun=true plans the loop without writing rows or calling Meta.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const role = await getSession();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as BulkRequest | null;
  if (!body || !Array.isArray(body.phoneE164s) || body.phoneE164s.length === 0) {
    return NextResponse.json({ error: "phoneE164s_required" }, { status: 400 });
  }

  if (body.phoneE164s.length > 500) {
    return NextResponse.json({ error: "too_many_phones", max: 500 }, { status: 400 });
  }

  const phones: string[] = [];
  for (const p of body.phoneE164s) {
    if (typeof p !== "string") {
      return NextResponse.json({ error: "phoneE164s_must_be_strings" }, { status: 400 });
    }
    const n = normalize(p);
    if (!n.e164) {
      return NextResponse.json({ error: "invalid_phone", phone: p }, { status: 400 });
    }
    phones.push(n.e164);
  }

  const force = body.force === true;
  const dryRun = body.dryRun === true;
  const inviteUrl = process.env.WA_GROUP_INVITE_URL;
  if (!inviteUrl) {
    return NextResponse.json({ error: "missing_invite_url" }, { status: 500 });
  }

  try {
    // One Yogo round-trip up front, then a phone→name lookup against every
    // variant the normalizer produces.
    const customers = await fetchAllYogoCustomers();
    const nameByKey = new Map<string, string>();
    for (const c of customers) {
      if (!c.phoneE164) continue;
      for (const k of normalize(c.phoneE164).variants) {
        if (!nameByKey.has(k)) nameByKey.set(k, c.displayName);
      }
    }

    const priorRows = await db.waOutbound.findMany({
      where: { phoneE164: { in: phones }, templateKey: TEMPLATE_KEY },
      select: { phoneE164: true, sentAt: true },
    });
    const priorByPhone = new Map<string, Date>(priorRows.map((r) => [r.phoneE164, r.sentAt]));

    const now = new Date();
    const details: SendDetail[] = [];

    for (const phoneE164 of phones) {
      const name = lookupName(nameByKey, phoneE164) ?? "amigo";

      const decision = idempotencyAllows(now, priorByPhone.get(phoneE164) ?? null, force);
      if (!decision.allowed) {
        details.push({
          phoneE164,
          outcome: "skipped",
          reason: `recently_invited_${decision.daysSince}_days`,
        });
        continue;
      }

      if (dryRun) {
        details.push({ phoneE164, outcome: "dry", reason: `would_send_to_${name}` });
        continue;
      }

      // Ensure the contact row exists so WaOutbound's FK is satisfied.
      await db.waContact.upsert({
        where: { phoneE164 },
        create: { phoneE164 },
        update: {},
      });

      // The @@unique([phoneE164, templateKey]) keeps the most recent attempt
      // only. Delete-then-create gives us atomic-enough overwrite semantics
      // without needing a transaction across the Meta call.
      await db.waOutbound.deleteMany({
        where: { phoneE164, templateKey: TEMPLATE_KEY },
      });

      const params = formatInviteParams(name, inviteUrl);
      const result = await sendWithRetry(phoneE164, params);

      if (result.ok) {
        await db.waOutbound.create({
          data: {
            phoneE164,
            kind: "template",
            payload: JSON.stringify({ template: TEMPLATE_NAME, name, url: inviteUrl }),
            status: "sent",
            templateKey: TEMPLATE_KEY,
          },
        });
        await db.waEvent.create({ data: { kind: "GROUP_INVITE_SENT", phoneE164 } });
        details.push({ phoneE164, outcome: "sent" });
      } else if (isAuthFailure(result.status)) {
        // Abort: don't burn through the cohort with bad credentials.
        await db.waOutbound.create({
          data: {
            phoneE164,
            kind: "template",
            payload: JSON.stringify({ template: TEMPLATE_NAME, name, url: inviteUrl }),
            status: "failed",
            templateKey: TEMPLATE_KEY,
            error: snippet(result.body),
          },
        });
        await db.waEvent.create({
          data: {
            kind: "GROUP_INVITE_FAIL",
            phoneE164,
            meta: JSON.stringify({ metaStatus: result.status, abort: true }),
          },
        });
        details.push({
          phoneE164,
          outcome: "failed",
          reason: "wa_auth_fail",
          metaStatus: result.status,
          metaError: snippet(result.body),
        });
        break;
      } else {
        const looksPending = isTemplatePendingError(result.body);
        const status = looksPending ? "pending" : "failed";
        const reason = looksPending
          ? "template_pending"
          : result.status === 429
            ? "rate_limited"
            : isInvalidRecipient(result.body)
              ? "invalid_recipient"
              : "meta_error";

        await db.waOutbound.create({
          data: {
            phoneE164,
            kind: "template",
            payload: JSON.stringify({ template: TEMPLATE_NAME, name, url: inviteUrl }),
            status,
            templateKey: TEMPLATE_KEY,
            error: snippet(result.body),
          },
        });
        await db.waEvent.create({
          data: {
            kind: looksPending ? "TEMPLATE_PENDING" : "GROUP_INVITE_FAIL",
            phoneE164,
            meta: JSON.stringify({ metaStatus: result.status }),
          },
        });
        details.push({
          phoneE164,
          outcome: "failed",
          reason,
          metaStatus: result.status,
          metaError: snippet(result.body),
        });
      }

      await sleep(PER_REQUEST_GAP_MS);
    }

    return NextResponse.json({ ...summarizeDetails(details), details });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "bulk_failed", message: msg }, { status: 500 });
  }
}

function lookupName(map: Map<string, string>, phoneE164: string): string | null {
  for (const k of normalize(phoneE164).variants) {
    const v = map.get(k);
    if (v) return v;
  }
  return null;
}

async function sendWithRetry(
  phoneE164: string,
  params: ReturnType<typeof formatInviteParams>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const first = await sendTemplate(phoneE164, TEMPLATE_NAME, LANGUAGE_CODE, params);
  if (first.status !== 429) return first;
  await sleep(1000);
  return sendTemplate(phoneE164, TEMPLATE_NAME, LANGUAGE_CODE, params);
}

function isAuthFailure(status: number): boolean {
  return status === 401 || status === 403;
}

// Meta returns 400 with a 132xxx code when a template is unknown or pending.
function isTemplatePendingError(body: string): boolean {
  return /template|not.{0,10}translated|not.{0,10}approved|132\d{3}/i.test(body);
}

// 131026 = "Message Undeliverable" (recipient not on WhatsApp).
function isInvalidRecipient(body: string): boolean {
  return /131026|invalid.{0,10}recipient|not.{0,10}a.{0,10}whatsapp/i.test(body);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snippet(s: string): string {
  return s.length <= 200 ? s : s.slice(0, 200);
}
