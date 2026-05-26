import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { computeCoverage } from "@/lib/wa/group-coverage";

// GET /api/whatsapp/admin/group-coverage
// Reconciles active recurring Yogo subscribers against the stored WhatsApp
// group roster and returns the three buckets used by /dashboard/wa/coverage.
export async function GET() {
  const role = await getSession();
  if (role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const report = await computeCoverage();
    return NextResponse.json(report);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "coverage_failed", message: msg }, { status: 500 });
  }
}
