import { NextRequest, NextResponse } from "next/server";
import { ADMIN_ONLY_ROUTES } from "./lib/constants";

export function proxy(request: NextRequest) {
  const session = request.cookies.get("striker_session");
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    if (!session || (session.value !== "admin" && session.value !== "sales")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session.value === "sales" && ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (pathname === "/login" && session && (session.value === "admin" || session.value === "sales")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
