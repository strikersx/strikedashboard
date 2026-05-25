import { NextResponse } from "next/server";
import { validatePassword, createSession, getSession, deleteSession } from "@/lib/auth";
import { isWaEnabled } from "@/lib/wa/config";

export async function POST(req: Request) {
  const body = await req.json();
  const role = validatePassword(body.password || "");
  if (!role) {
    return NextResponse.json({ error: "senha inválida" }, { status: 401 });
  }
  await createSession(role);
  return NextResponse.json({ role });
}

export async function GET() {
  const role = await getSession();
  if (!role) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ role, waEnabled: isWaEnabled() });
}

export async function DELETE() {
  await deleteSession();
  return NextResponse.json({ ok: true });
}
