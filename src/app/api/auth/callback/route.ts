import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/server/db";
import { User } from "@/server/models";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/server/session";

export const dynamic = "force-dynamic";

const origin = (req: NextRequest) => (process.env.SITE_URL || req.nextUrl.origin).trim().replace(/\/+$/, "");
// Only allow redirects to paths on this site.
const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/admin");

// Step 2: Discord sends the visitor back with ?code. Exchange it, find or create the user, set the session.
export async function GET(req: NextRequest) {
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, origin(req)));
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("tsmp_oauth_state")?.value;
  const next = safeNext(req.cookies.get("tsmp_oauth_next")?.value);
  if (req.nextUrl.searchParams.get("error")) return fail("denied");
  if (!code || !state || !savedState || state !== savedState) return fail("state");

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || "",
        client_secret: process.env.DISCORD_CLIENT_SECRET || "",
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin(req)}/api/auth/callback`,
      }),
    });
    if (!tokenRes.ok) return fail("token");
    const { access_token } = await tokenRes.json();
    const meRes = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${access_token}` } });
    if (!meRes.ok) return fail("profile");
    const me = await meRes.json();

    await connectDB();
    const owners = (process.env.OWNER_DISCORD_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const user = await User.findOneAndUpdate(
      { discordId: String(me.id) },
      {
        $set: {
          username: me.global_name || me.username,
          avatar: me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128` : null,
          email: me.email || undefined,
          lastLoginAt: new Date(),
        },
        $setOnInsert: { role: owners.includes(String(me.id)) ? "owner" : "user" }, // discordId comes from the filter
      },
      { upsert: true, new: true }
    );
    if (user.banned) return fail("banned");
    // Anyone listed in OWNER_DISCORD_IDS is always an owner (this is how the first admin is created).
    if (owners.includes(user.discordId) && user.role !== "owner") {
      user.role = "owner";
      await user.save();
    }

    const res = NextResponse.redirect(new URL(next, origin(req)));
    res.cookies.set(SESSION_COOKIE, await signSession(String(user._id)), sessionCookieOptions);
    res.cookies.delete("tsmp_oauth_state");
    res.cookies.delete("tsmp_oauth_next");
    return res;
  } catch (e) {
    console.error("discord login failed", e);
    return fail("server");
  }
}
