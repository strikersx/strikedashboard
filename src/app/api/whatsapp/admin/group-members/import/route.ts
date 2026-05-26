import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseGroupCsv } from "@/lib/wa/group-import";

// POST /api/whatsapp/admin/group-members/import
// Accepts the raw WhatsApp contacts export (tab- or comma-separated) either as
// `text/plain` body or `{ csv: "..." }` JSON. Upserts each parsed row into
// WaGroupMember. The whole roster is replaced — anything not in the upload is
// deleted so the table reflects the current group composition exactly.
export async function POST(req: NextRequest) {
  const role = await getSession();
  if (role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let csv = "";
  const ctype = req.headers.get("content-type") ?? "";
  try {
    if (ctype.includes("application/json")) {
      const body = (await req.json()) as { csv?: unknown };
      if (typeof body.csv === "string") csv = body.csv;
    } else {
      csv = await req.text();
    }
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!csv.trim()) return NextResponse.json({ error: "empty_body" }, { status: 400 });

  const parsed = parseGroupCsv(csv);
  if (parsed.rows.length === 0) {
    return NextResponse.json({
      error: "no_rows_parsed",
      skipped: parsed.skipped.slice(0, 20),
    }, { status: 400 });
  }

  const now = new Date();
  let inserted = 0;
  let updated = 0;
  for (const row of parsed.rows) {
    const existing = await db.waGroupMember.findUnique({ where: { phoneE164: row.phoneE164 } });
    await db.waGroupMember.upsert({
      where: { phoneE164: row.phoneE164 },
      create: { ...row, importedAt: now, updatedAt: now },
      update: { ...row, updatedAt: now },
    });
    if (existing) updated++; else inserted++;
  }

  const keep = parsed.rows.map((r) => r.phoneE164);
  const deleted = await db.waGroupMember.deleteMany({
    where: { phoneE164: { notIn: keep } },
  });

  await db.waEvent.create({
    data: {
      kind: "GROUP_ROSTER_IMPORT",
      meta: JSON.stringify({
        inserted,
        updated,
        deleted: deleted.count,
        skipped: parsed.skipped.length,
      }),
    },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    inserted,
    updated,
    deleted: deleted.count,
    skipped: parsed.skipped,
    total: parsed.rows.length,
  });
}
