import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/server/db";
import { Order } from "@/server/models/Store";
import { getCurrentUser } from "@/server/session";
import { markOrderPaid } from "@/server/checkout/fulfil";
import { verifyRazorpayPayment } from "@/server/checkout/signatures";

export const dynamic = "force-dynamic";

// Razorpay Checkout hands the browser {order_id, payment_id, signature}. The signature (made with our key secret)
// proves that payment belongs to an order WE created with the amount WE set, so we can mark it paid at once
// instead of waiting for the webhook. The webhook stays the source of truth; both paths are idempotent.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const orderId = String(b.razorpay_order_id || "");
  const paymentId = String(b.razorpay_payment_id || "");
  const signature = String(b.razorpay_signature || "");
  if (!verifyRazorpayPayment(orderId, paymentId, signature, process.env.RAZORPAY_KEY_SECRET)) {
    return NextResponse.json({ ok: false, error: "Bad signature." }, { status: 400 });
  }
  try {
    await connectDB();
    const order = await Order.findOne({ provider: "razorpay", providerOrderId: orderId, userId: user.id }).lean();
    if (!order) return NextResponse.json({ ok: false }, { status: 404 });
    const r = await markOrderPaid({ provider: "razorpay", providerOrderId: orderId, providerPaymentId: paymentId, amount: order.total, currency: order.currency });
    return NextResponse.json({ ok: r.result !== "mismatch" && r.result !== "unknown", orderNo: order.orderNo });
  } catch (e) {
    console.error("[checkout] razorpay-verify failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
