import { connectDB } from "../db";
import { Coupon, Order } from "../models/Store";
import { deliverOrder } from "../store/deliver";

export type PaidResult = {
  result: "paid" | "already" | "unknown" | "mismatch";
  message?: string;
};

/**
 * Called only after a gateway signature was verified. Idempotent: the pending -> paid transition is a single
 * atomic update, so only the first call bumps the coupon and starts delivery. A repeated webhook for an order that
 * is still `paid` (delivery failed or never ran) just retries `deliverOrder`, which is itself idempotent.
 */
export async function markOrderPaid(p: {
  provider: "razorpay" | "stripe";
  providerOrderId: string;
  providerPaymentId?: string;
  amount: number; // smallest unit, as reported by the gateway
  currency: string;
}): Promise<PaidResult> {
  await connectDB();
  const order = await Order.findOne({ provider: p.provider, providerOrderId: p.providerOrderId });
  if (!order) return { result: "unknown", message: "no matching order" };

  if (order.status !== "pending") {
    if (order.status === "paid") {
      const d = await safeDeliver(String(order._id));
      return { result: "already", message: d.message };
    }
    return { result: "already", message: `order is ${order.status}` };
  }

  if (p.amount !== order.total || p.currency.toUpperCase() !== order.currency) {
    const message = `amount/currency mismatch: expected ${order.total} ${order.currency}, gateway reported ${p.amount} ${p.currency.toUpperCase()}`;
    await Order.updateOne(
      { _id: order._id, status: "pending" },
      {
        $set: { status: "failed", providerPaymentId: p.providerPaymentId },
        $push: { deliveryLog: { at: new Date(), step: "payment", ok: false, message } },
      }
    );
    console.error(`[checkout] ${order.orderNo}: ${message}`);
    return { result: "mismatch", message };
  }

  const paid = await Order.findOneAndUpdate(
    { _id: order._id, status: "pending" },
    {
      $set: { status: "paid", paidAt: new Date(), providerPaymentId: p.providerPaymentId },
      $push: { deliveryLog: { at: new Date(), step: "payment", ok: true, message: `paid via ${p.provider}` } },
    },
    { new: true }
  );
  if (!paid) return { result: "already", message: "handled concurrently" };

  if (paid.couponCode) await Coupon.updateOne({ code: paid.couponCode }, { $inc: { used: 1 } });
  const d = await safeDeliver(String(paid._id));
  return { result: "paid", message: d.message };
}

async function safeDeliver(orderId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    return await deliverOrder(orderId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "delivery failed";
    console.error(`[checkout] deliverOrder threw for ${orderId}: ${message}`);
    return { ok: false, message };
  }
}
