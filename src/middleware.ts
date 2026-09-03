import { NextRequest, NextResponse } from "next/server";

// NOTE: Next.js middleware runs on the Edge runtime, which cannot use the
// Node `crypto`-based `jsonwebtoken` package. This layer therefore only does
// a cheap "is a session cookie present" redirect gate. The real, cryptographic
// JWT verification (signature + expiry + active-user check) happens in
// requireAuth() inside every API route and server page — that is the actual
// security boundary, not this file.
const AUTH_COOKIE_NAME = "bordershield_token";
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  const hasCookie = !!req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
