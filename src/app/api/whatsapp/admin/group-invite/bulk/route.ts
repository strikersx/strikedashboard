import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalize } from "@/lib/phone";
import { fetchAllYogoCustomers } from "@/lib/yogo/recurring-subs";
import {
  idempotencyAllows,
  summarizeDetails,
  type SendDetail,
} from "@/lib/wa/group-invite";

const TEMPLATE_KEY = "grp_invite";

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

  const now = new Date();
  const details: SendDetail[] = [];

  for (const phoneE164 of phones) {
    const name = lookupName(nameByKey, phoneE164) ?? "amigo";

    const prior = await db.waOutbound.findFirst({
      where: { phoneE164, templateKey: TEMPLATE_KEY },
      select: { sentAt: true },
    });

    const decision = idempotencyAllows(now, prior?.sentAt ?? null, force);
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

    // Real send lands in Task 5.
    details.push({ phoneE164, outcome: "failed", reason: "send_not_implemented" });
  }

  return NextResponse.json({ ...summarizeDetails(details), details });
}

function lookupName(map: Map<string, string>, phoneE164: string): string | null {
  for (const k of normalize(phoneE164).variants) {
    const v = map.get(k);
    if (v) return v;
  }
  return null;
}
