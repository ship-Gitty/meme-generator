import { auth } from "@/auth";
import { NextResponse } from "next/server";

// FR-1: /dashboard requires a valid session. Because this app uses the
// "database" session strategy, this auth() call performs a real adapter (DB)
// lookup on every matched request — it is authoritative, not a cookie-
// presence-only optimistic check. Page-level auth() calls (e.g.
// dashboard/page.tsx) are kept as defense-in-depth regardless.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  if (pathname.startsWith("/dashboard") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
