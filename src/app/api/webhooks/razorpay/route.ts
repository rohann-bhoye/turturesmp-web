import { NextRequest, NextResponse } from "next/server";
import { markOrderPaid } from "@/server/checkout/fulfil";
import { verifyRazorpayWebhook } from "@/server/checkout/signatures";

export const dynamic = "force-dynamic";

type RzPayment = { id?: string; order_id?: string; amount?: number; currency?: string; status?: string };

export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const raw = await req.text(); // the signature covers the exact raw bytes
  if (!verifyRazorpayWebhook(raw, req.headers.get("x-razorpay-signature"), secret)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let event: { event?: string; payload?: { payment?: { entity?: RzPayment }; order?: { entity?: { id?: string; amount?: number; amount_paid?: number; currency?: string } } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (event.event !== "payment.captured" && event.event !== "order.paid") return NextResponse.json({ ok: true, ignored: true });

  const pay = event.payload?.payment?.entity;
  const ord = event.payload?.order?.entity;
  const orderId = pay?.order_id || ord?.id;
  const amount = pay?.amount ?? ord?.amount_paid ?? ord?.amount;
  const currency = pay?.currency || ord?.currency;
  if (!orderId || typeof amount !== "number" || !currency) return NextResponse.json({ ok: true, ignored: true });

  try {
    const r = await markOrderPaid({ provider: "razorpay", providerOrderId: orderId, providerPaymentId: pay?.id, amount, currency });
    return NextResponse.json({ ok: true, result: r.result });
  } catch (e) {
    console.error("[webhook:razorpay] failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false }, { status: 500 }); // gateway will retry
  }
}
