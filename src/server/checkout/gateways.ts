// Thin fetch clients for Razorpay Orders and Stripe Checkout Sessions. No SDKs. Never log secrets or full responses.
import type { Currency } from "./validate";

export type GatewayConfig = { razorpay: boolean; stripe: boolean };
export function gatewayConfig(): GatewayConfig {
  return {
    razorpay: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    stripe: !!process.env.STRIPE_SECRET_KEY,
  };
}

export function siteUrl(fallbackOrigin: string): string {
  return (process.env.SITE_URL || fallbackOrigin).replace(/\/+$/, "");
}

async function readError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    const msg = j?.error?.description || j?.error?.message;
    return typeof msg === "string" ? msg.slice(0, 200) : `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function createRazorpayOrder(opts: { amount: number; receipt: string; orderNo: string }): Promise<{ id: string; keyId: string }> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured.");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
    },
    body: JSON.stringify({ amount: opts.amount, currency: "INR", receipt: opts.receipt, notes: { orderNo: opts.orderNo } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Razorpay: " + (await readError(res)));
  const j = await res.json();
  if (typeof j?.id !== "string") throw new Error("Razorpay: unexpected response.");
  return { id: j.id, keyId };
}

export async function createStripeSession(opts: {
  amount: number;
  currency: Currency;
  productName: string;
  orderNo: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured.");
  const form = new URLSearchParams({
    mode: "payment",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    client_reference_id: opts.orderNo,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": opts.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(opts.amount),
    "line_items[0][price_data][product_data][name]": opts.productName,
    "metadata[orderNo]": opts.orderNo,
    "payment_intent_data[metadata][orderNo]": opts.orderNo,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${key}`,
      "Idempotency-Key": `tsmp-${opts.orderNo}`,
    },
    body: form,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Stripe: " + (await readError(res)));
  const j = await res.json();
  if (typeof j?.id !== "string" || typeof j?.url !== "string") throw new Error("Stripe: unexpected response.");
  return { id: j.id, url: j.url };
}
