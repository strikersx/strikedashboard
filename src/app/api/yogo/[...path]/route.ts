import { NextRequest } from "next/server";
import { proxyToYogo } from "@/lib/yogo-proxy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = path.join("/");
  const search = req.nextUrl.search;
  return proxyToYogo(apiPath + search);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = path.join("/");
  const body = await req.text();
  return proxyToYogo(apiPath, "POST", body);
}
