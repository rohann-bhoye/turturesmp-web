import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Cheap gate: no valid signed cookie, no /admin. The page itself re-checks the role in the database.
export async function middleware(req: NextRequest) {
  const login = new URL("/login", req.url);
  login.searchParams.set("next", req.nextUrl.pathname);
  const token = req.cookies.get("tsmp_session")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return NextResponse.redirect(login);
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(login);
  }
}

export const config = { matcher: ["/admin/:path*"] };
