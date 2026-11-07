import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const origin = (req: NextRequest) => (process.env.SITE_URL || req.nextUrl.origin).trim().replace(/\/+$/, "");

// Step 1: send the visitor to Discord's consent screen.
export async function GET(req: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId || !process.env.DISCORD_CLIENT_SECRET || !process.env.AUTH_SECRET) {
    return NextResponse.redirect(new URL("/login?error=setup", origin(req)));
  }
  const state = randomBytes(24).toString("hex");
  const next = req.nextUrl.searchParams.get("next") || "/admin";
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${origin(req)}/api/auth/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify email");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "none");
  const res = NextResponse.redirect(url);
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 };
  res.cookies.set("tsmp_oauth_state", state, opts);
  res.cookies.set("tsmp_oauth_next", next, opts);
  return res;
}
