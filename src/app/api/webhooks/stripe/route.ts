import { NextRequest, NextResponse } from "next/server";
import { markOrderPaid } from "@/server/checkout/fulfil";
import { verifyStripeWebhook } from "@/server/checkout/signatures";

export const dynamic = "force-dynamic";

type StripeSession = { id?: string; payment_status?: string; amount_total?: number; currency?: string; payment_intent?: string | null };

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const raw = await req.text(); // the signature covers the exact raw bytes
  if (!verifyStripeWebhook(raw, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: StripeSession } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const s = event.data?.object;
  // Delayed payment methods complete the session before the money arrives; wait for async_payment_succeeded.
  if (!s?.id || s.payment_status !== "paid" || typeof s.amount_total !== "number" || !s.currency) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const r = await markOrderPaid({
      provider: "stripe",
      providerOrderId: s.id,
      providerPaymentId: typeof s.payment_intent === "string" ? s.payment_intent : undefined,
      amount: s.amount_total,
      currency: s.currency,
    });
    return NextResponse.json({ ok: true, result: r.result });
  } catch (e) {
    console.error("[webhook:stripe] failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false }, { status: 500 }); // gateway will retry
  }
}
