import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalize } from "../../src/lib/phone";
import { parseReport } from "../../src/lib/utils";
import { ALL_SUB_IDS } from "../../src/lib/constants";

const ENV_PATH = resolve(__dirname, "..", "..", ".env.local");
const env = loadDotEnv(ENV_PATH);
const TOKEN = env.YOGO_TOKEN || process.env.YOGO_TOKEN;
const BASE = env.YOGO_BASE || process.env.YOGO_BASE || "https://api.yogo.dk";
const ORIGIN = env.YOGO_ORIGIN || process.env.YOGO_ORIGIN || "https://strikershouse.yogobooking.pt";
const RUN_SPIKES = process.env.RUN_SPIKES === "1";

const GATE_HIT_RATE = 0.98;

interface YogoCustomer {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  createdAt?: string;
}

interface ClassPassType {
  id: number;
  archived?: number;
}

describe("G2 phone-normalisation spike", () => {
  it.skipIf(!TOKEN || !RUN_SPIKES)(
    "≥98% of Yogo customer phones normalise to single E.164",
    async () => {
      const passIds = await fetchAllClassPassTypeIds();
      console.log(`  Found ${passIds.length} class_pass_type IDs`);

      const customers = await fetchAllCustomers(passIds);
      const result = measure(customers);

      console.log("\n=== G2 PHONE SPIKE RESULT ===");
      console.log(
        JSON.stringify(
          {
            total: result.total,
            withPhone: result.withPhone,
            empty: result.empty,
            hit: result.hit,
            miss: result.miss,
            hitRate: `${(result.hitRate * 100).toFixed(2)}%`,
            gate: `${GATE_HIT_RATE * 100}%`,
            passed: result.hitRate >= GATE_HIT_RATE,
          },
          null,
          2,
        ),
      );

      if (result.missSamples.length > 0) {
        console.log("\n=== MISS SAMPLES (all) ===");
        for (const s of result.missSamples) {
          console.log(`  ${s.raw.padEnd(32)} | id=${s.id} ${s.name}`);
        }
      }

      if (result.hitSamples.length > 0) {
        console.log("\n=== HIT SAMPLES (first 10) ===");
        for (const s of result.hitSamples.slice(0, 10)) {
          console.log(`  ${s.raw.padEnd(32)} → ${s.e164}`);
        }
      }

      expect(result.hitRate).toBeGreaterThanOrEqual(GATE_HIT_RATE);
    },
    60_000,
  );
});

interface SpikeResult {
  total: number;
  withPhone: number;
  empty: number;
  hit: number;
  miss: number;
  hitRate: number;
  missSamples: Array<{ raw: string; id: number; name: string }>;
  hitSamples: Array<{ raw: string; e164: string }>;
}

function measure(customers: YogoCustomer[]): SpikeResult {
  let withPhone = 0;
  let empty = 0;
  let hit = 0;
  let miss = 0;
  const missSamples: SpikeResult["missSamples"] = [];
  const hitSamples: SpikeResult["hitSamples"] = [];

  for (const c of customers) {
    const raw = (c.phone ?? "").trim();
    if (!raw) {
      empty++;
      continue;
    }
    withPhone++;
    const { e164 } = normalize(raw);
    if (e164) {
      hit++;
      if (hitSamples.length < 10) hitSamples.push({ raw, e164 });
    } else {
      miss++;
      missSamples.push({
        raw,
        id: c.id,
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      });
    }
  }

  const hitRate = withPhone === 0 ? 0 : hit / withPhone;
  return { total: customers.length, withPhone, empty, hit, miss, hitRate, missSamples, hitSamples };
}

async function fetchAllClassPassTypeIds(): Promise<number[]> {
  const res = await yogoFetch("GET", "class-pass-types");
  const data = (await res.json()) as ClassPassType[];
  if (!Array.isArray(data)) {
    throw new Error(`Unexpected /class-pass-types shape: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.map((p) => p.id).filter((id): id is number => typeof id === "number");
}

async function fetchAllCustomers(passIds: number[]): Promise<YogoCustomer[]> {
  const calls = [
    {
      label: "cold-leads-no-membership-no-pass",
      body: {
        filters: [
          { type: "hasNoMembership", membershipTypeId: [], onlyActiveMemberships: false },
          { type: "hasNoClassPass", classPassTypeId: [], onlyActiveClassPasses: false },
        ],
        returnColumnHeaders: true,
      },
    },
    {
      label: "anyone-with-membership",
      body: {
        filters: [
          {
            type: "hasMembershipOrClassPass",
            membershipTypeId: ALL_SUB_IDS,
            classPassTypeId: [],
            onlyActiveMembershipsOrClassPasses: false,
          },
        ],
        returnColumnHeaders: true,
      },
    },
    {
      label: "anyone-with-classpass",
      body: {
        filters: [
          {
            type: "hasMembershipOrClassPass",
            membershipTypeId: [],
            classPassTypeId: passIds,
            onlyActiveMembershipsOrClassPasses: false,
          },
        ],
        returnColumnHeaders: true,
      },
    },
  ];

  const map = new Map<number, YogoCustomer>();
  for (const call of calls) {
    const res = await yogoFetch("POST", "reports/customers", call.body);
    const raw = await res.json();
    const rows = parseReport(raw) as unknown as YogoCustomer[];
    console.log(`  [${call.label}] returned ${rows.length} rows`);
    for (const row of rows) {
      if (typeof row.id === "number" && !map.has(row.id)) map.set(row.id, row);
    }
  }
  return Array.from(map.values());
}

async function yogoFetch(method: "GET" | "POST", path: string, body?: unknown): Promise<Response> {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "x-yogo-request-context": "admin",
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      Origin: ORIGIN,
      Referer: `${ORIGIN}/`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Yogo ${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

function loadDotEnv(path: string): Record<string, string> {
  try {
    const raw = readFileSync(path, "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let value = m[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[m[1]] = value;
    }
    return out;
  } catch {
    return {};
  }
}
