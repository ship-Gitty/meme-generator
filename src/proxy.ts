import { auth } from "@/auth";
import { NextResponse } from "next/server";

// FR-1: /dashboard requires a valid session. Optimistic check only (session
// presence, not a DB round-trip) — see Next.js authentication guide.
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
