import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { connectDB } from "./db";
import { User } from "./models";
import type { Role } from "./roles";

export const SESSION_COOKIE = "tsmp_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Which parts of the setup are present (names only, never values).
export function setupStatus() {
  return {
    MONGODB_URI: !!process.env.MONGODB_URI,
    AUTH_SECRET: (process.env.AUTH_SECRET || "").length >= 32,
    DISCORD_CLIENT_ID: !!process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: !!process.env.DISCORD_CLIENT_SECRET,
    OWNER_DISCORD_IDS: !!process.env.OWNER_DISCORD_IDS,
  };
}
export const isConfigured = () => Object.values(setupStatus()).every(Boolean);

const key = () => new TextEncoder().encode(process.env.AUTH_SECRET || "");

export async function signSession(uid: string) {
  return new SignJWT({ uid }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(key());
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};

export type SessionUser = {
  id: string;
  discordId: string;
  username: string;
  avatar?: string | null;
  role: Role;
  minecraftName?: string | null;
};

// Reads the cookie, then loads the user from the database, so role changes and bans apply immediately.
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!(process.env.AUTH_SECRET || "").length) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    await connectDB();
    const u = await User.findById(String(payload.uid)).lean();
    if (!u || u.banned) return null;
    return {
      id: String(u._id),
      discordId: u.discordId,
      username: u.username,
      avatar: u.avatar,
      role: u.role as Role,
      minecraftName: u.minecraft?.name,
    };
  } catch {
    return null;
  }
}
