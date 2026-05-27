import { db } from "@/lib/db";
import {
  fetchActiveRecurringSubs,
  fetchAllYogoCustomers,
  type ActiveRecurringSub,
  type YogoCustomerLite,
} from "@/lib/yogo/recurring-subs";
import { normalize } from "@/lib/phone";

export interface CoverageMember {
  phoneE164: string;
  savedName: string | null;
  publicName: string | null;
  labels: string | null;
  isBusiness: boolean;
}

export interface CoverageSub {
  customerId: number;
  displayName: string;
  phoneE164: string | null;
  phoneRaw: string | null;
  plan: string | null;
}

export interface LastInvite {
  sentAt: string;        // ISO 8601
  status: string;        // "sent" | "failed" | "pending" (set by /api/whatsapp/admin/group-invite/bulk)
  error: string | null;
}

export interface CoverageExClient {
  customerId: number;
  displayName: string;
  phoneE164: string | null;
  phoneRaw: string | null;
  lastPlan: string | null;
  lastStatus: string | null;
  paidUntil: string | null;
  member: CoverageMember;
}

export interface CoverageReport {
  generatedAt: string;
  totals: {
    subsActive: number;
    inGroup: number;
    covered: number;
    coveredInactive: number;
    missingFromGroup: number;
    unknownInGroup: number;
    subsWithoutPhone: number;
  };
  covered: Array<CoverageSub & { member: CoverageMember }>;
  coveredInactive: CoverageExClient[];
  missingFromGroup: Array<CoverageSub & { lastInvite: LastInvite | null }>;
  unknownInGroup: CoverageMember[];
  subsWithoutPhone: CoverageSub[];
}

export async function computeCoverage(): Promise<CoverageReport> {
  const [activeSubs, allCustomers, members, inviteRows] = await Promise.all([
    fetchActiveRecurringSubs(),
    fetchAllYogoCustomers(),
    db.waGroupMember.findMany(),
    db.waOutbound.findMany({
      where: { templateKey: "grp_invite" },
      select: { phoneE164: true, status: true, error: true, sentAt: true },
    }),
  ]);

  // At most one row per phone thanks to @@unique([phoneE164, templateKey]);
  // the loop is effectively a 1:1 mapping, no orderBy needed.
  const inviteByKey = new Map<string, LastInvite>();
  for (const r of inviteRows) {
    const li: LastInvite = {
      sentAt: r.sentAt.toISOString(),
      status: r.status,
      error: r.error ?? null,
    };
    for (const k of keysFor(r.phoneE164)) inviteByKey.set(k, li);
  }

  // Index group members by every phone variant so a single lookup hits all
  // formats Yogo might have stored (E.164, no-+, no-country-code).
  const memberByKey = new Map<string, CoverageMember>();
  for (const m of members) {
    const cm: CoverageMember = {
      phoneE164: m.phoneE164,
      savedName: m.savedName,
      publicName: m.publicName,
      labels: m.labels,
      isBusiness: m.isBusiness,
    };
    for (const k of keysFor(m.phoneE164)) memberByKey.set(k, cm);
  }

  // Active recurring sub map, keyed by every phone variant.
  const activeByKey = new Map<string, ActiveRecurringSub>();
  for (const s of activeSubs) {
    if (!s.phoneE164) continue;
    for (const k of keysFor(s.phoneE164)) activeByKey.set(k, s);
  }

  // All Yogo customers map, keyed by every phone variant. Includes the active
  // ones — used to detect "in group, in Yogo at all".
  const yogoByKey = new Map<string, YogoCustomerLite>();
  for (const c of allCustomers) {
    if (!c.phoneE164) continue;
    for (const k of keysFor(c.phoneE164)) {
      if (!yogoByKey.has(k)) yogoByKey.set(k, c);
    }
  }

  const covered: Array<CoverageSub & { member: CoverageMember }> = [];
  const coveredInactive: CoverageExClient[] = [];
  const unknownInGroup: CoverageMember[] = [];
  const matchedMemberPhones = new Set<string>();

  for (const m of members) {
    const variants = keysFor(m.phoneE164);
    const activeHit = lookup(activeByKey, variants);
    const yogoHit = lookup(yogoByKey, variants);

    const cm: CoverageMember = {
      phoneE164: m.phoneE164,
      savedName: m.savedName,
      publicName: m.publicName,
      labels: m.labels,
      isBusiness: m.isBusiness,
    };

    if (activeHit) {
      covered.push({ ...toCoverageSub(activeHit), member: cm });
      matchedMemberPhones.add(m.phoneE164);
    } else if (yogoHit) {
      coveredInactive.push({
        customerId: yogoHit.customerId,
        displayName: yogoHit.displayName,
        phoneE164: yogoHit.phoneE164,
        phoneRaw: yogoHit.phoneRaw,
        lastPlan: yogoHit.lastPlan,
        lastStatus: yogoHit.lastStatus,
        paidUntil: yogoHit.paidUntil,
        member: cm,
      });
      matchedMemberPhones.add(m.phoneE164);
    } else {
      unknownInGroup.push(cm);
    }
  }

  const missingFromGroup: Array<CoverageSub & { lastInvite: LastInvite | null }> = [];
  const subsWithoutPhone: CoverageSub[] = [];
  for (const s of activeSubs) {
    const cs = toCoverageSub(s);
    if (!cs.phoneE164) { subsWithoutPhone.push(cs); continue; }
    const hit = lookup(memberByKey, keysFor(cs.phoneE164));
    if (!hit) {
      const lastInvite = lookup(inviteByKey, keysFor(cs.phoneE164)) ?? null;
      missingFromGroup.push({ ...cs, lastInvite });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      subsActive: activeSubs.length,
      inGroup: members.length,
      covered: covered.length,
      coveredInactive: coveredInactive.length,
      missingFromGroup: missingFromGroup.length,
      unknownInGroup: unknownInGroup.length,
      subsWithoutPhone: subsWithoutPhone.length,
    },
    covered: covered.sort(byName),
    coveredInactive: coveredInactive.sort(byName),
    missingFromGroup: missingFromGroup.sort(byName),
    unknownInGroup: unknownInGroup.sort((a, b) => (a.savedName ?? a.publicName ?? "").localeCompare(b.savedName ?? b.publicName ?? "")),
    subsWithoutPhone: subsWithoutPhone.sort(byName),
  };
}

function lookup<T>(map: Map<string, T>, keys: string[]): T | undefined {
  for (const k of keys) {
    const v = map.get(k);
    if (v) return v;
  }
  return undefined;
}

function toCoverageSub(s: ActiveRecurringSub): CoverageSub {
  return {
    customerId: s.customerId,
    displayName: s.displayName,
    phoneE164: s.phoneE164,
    phoneRaw: s.phoneRaw,
    plan: s.plan,
  };
}

function byName(a: { displayName: string }, b: { displayName: string }): number {
  return a.displayName.localeCompare(b.displayName, "pt", { sensitivity: "base" });
}

function keysFor(e164: string): string[] {
  const n = normalize(e164);
  return n.variants.length > 0 ? n.variants : [e164];
}
