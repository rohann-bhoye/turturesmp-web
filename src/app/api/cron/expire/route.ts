import { NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/server/checkout/signatures";
import { expireEntitlements } from "@/server/store/deliver";

export const dynamic = "force-dynamic";

// Call on a schedule (e.g. Vercel Cron, which sends "Authorization: Bearer $CRON_SECRET").
export async function GET(req: NextRequest) {
  if (!verifyBearer(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const { checked, revoked, failed } = await expireEntitlements();
    return NextResponse.json({ ok: true, checked, revoked, failed });
  } catch (e) {
    console.error("[cron:expire] failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
