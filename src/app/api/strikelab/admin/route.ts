import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/strikelab/admin?search=...&page=1
 *
 * Admin-only. Lists gamification identities with their state.
 * Search filters by customerId, phone, or email.
 */
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("session");
  if (!cookie?.value) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { phoneE164: { contains: search } },
          { email: { contains: search } },
          ...( /^\d+$/.test(search) ? [{ customerId: parseInt(search, 10) }] : []),
        ],
        erasedAt: null,
      }
    : { erasedAt: null };

  const [identities, total] = await Promise.all([
    db.gamificationIdentity.findMany({
      where,
      orderBy: { optInAt: "desc" },
      skip,
      take: limit,
      include: { state: true },
    }),
    db.gamificationIdentity.count({ where }),
  ]);

  return NextResponse.json({
    students: identities.map((i) => ({
      customerId: i.customerId,
      phoneE164: i.phoneE164.startsWith("erased_") ? null : i.phoneE164,
      email: i.email,
      instagramHandle: i.instagramHandle,
      igVerified: !!i.igVerifiedAt,
      optedIn: !!i.optInAt && i.consentTraining,
      birthYear: i.birthYear,
      erasedAt: i.erasedAt,
      state: i.state
        ? {
            monthlyPoints: i.state.monthlyPoints,
            lifetimeXp: i.state.lifetimeXp,
            currentTier: i.state.currentTier,
            currentStreakDays: i.state.currentStreakDays,
            lastClassAt: i.state.lastClassAt,
          }
        : null,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
