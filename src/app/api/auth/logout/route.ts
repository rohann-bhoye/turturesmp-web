import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/server/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", (process.env.SITE_URL || req.nextUrl.origin).trim().replace(/\/+$/, "")), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
