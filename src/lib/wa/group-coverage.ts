import { db } from "@/lib/db";
import { fetchActiveRecurringSubs, type ActiveRecurringSub } from "@/lib/yogo/recurring-subs";
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

export interface CoverageReport {
  generatedAt: string;
  totals: {
    subsActive: number;
    inGroup: number;
    covered: number;
    missingFromGroup: number;
    extraInGroup: number;
    subsWithoutPhone: number;
  };
  covered: Array<CoverageSub & { member: CoverageMember }>;
  missingFromGroup: CoverageSub[];
  extraInGroup: CoverageMember[];
  subsWithoutPhone: CoverageSub[];
}

export async function computeCoverage(): Promise<CoverageReport> {
  const [subs, members] = await Promise.all([
    fetchActiveRecurringSubs(),
    db.waGroupMember.findMany(),
  ]);

  const memberKeyToRow = new Map<string, CoverageMember>();
  for (const m of members) {
    const cm: CoverageMember = {
      phoneE164: m.phoneE164,
      savedName: m.savedName,
      publicName: m.publicName,
      labels: m.labels,
      isBusiness: m.isBusiness,
    };
    for (const k of keysFor(m.phoneE164)) memberKeyToRow.set(k, cm);
  }

  const covered: Array<CoverageSub & { member: CoverageMember }> = [];
  const missingFromGroup: CoverageSub[] = [];
  const subsWithoutPhone: CoverageSub[] = [];
  const matchedMemberPhones = new Set<string>();

  for (const s of subs) {
    const cs = toCoverageSub(s);
    if (!cs.phoneE164) { subsWithoutPhone.push(cs); continue; }
    let hit: CoverageMember | undefined;
    for (const k of keysFor(cs.phoneE164)) {
      const h = memberKeyToRow.get(k);
      if (h) { hit = h; break; }
    }
    if (hit) {
      covered.push({ ...cs, member: hit });
      matchedMemberPhones.add(hit.phoneE164);
    } else {
      missingFromGroup.push(cs);
    }
  }

  const extraInGroup: CoverageMember[] = members
    .filter((m) => !matchedMemberPhones.has(m.phoneE164))
    .map((m) => ({
      phoneE164: m.phoneE164,
      savedName: m.savedName,
      publicName: m.publicName,
      labels: m.labels,
      isBusiness: m.isBusiness,
    }));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      subsActive: subs.length,
      inGroup: members.length,
      covered: covered.length,
      missingFromGroup: missingFromGroup.length,
      extraInGroup: extraInGroup.length,
      subsWithoutPhone: subsWithoutPhone.length,
    },
    covered: covered.sort(byName),
    missingFromGroup: missingFromGroup.sort(byName),
    extraInGroup: extraInGroup.sort((a, b) => (a.savedName ?? a.publicName ?? "").localeCompare(b.savedName ?? b.publicName ?? "")),
    subsWithoutPhone: subsWithoutPhone.sort(byName),
  };
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

// Two phones match if their normalised variants intersect. Pre-expand each
// stored phone into all its variants so lookups stay O(1).
function keysFor(e164: string): string[] {
  const n = normalize(e164);
  return n.variants.length > 0 ? n.variants : [e164];
}
