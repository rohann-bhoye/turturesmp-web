// Pure webhook / payment signature helpers (no I/O, no secrets logged). Constant-time comparisons.
import { createHmac, timingSafeEqual } from "crypto";

const hmacHex = (secret: string, data: string) => createHmac("sha256", secret).update(data, "utf8").digest("hex");

/** Constant-time compare of two hex strings. Different lengths or non-hex input return false. */
export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  const x = Buffer.from(a.toLowerCase(), "hex");
  const y = Buffer.from(b.toLowerCase(), "hex");
  if (x.length !== y.length || x.length === 0) return false;
  return timingSafeEqual(x, y);
}

/** Razorpay webhook: X-Razorpay-Signature = HMAC_SHA256(webhookSecret, rawBody). */
export function verifyRazorpayWebhook(rawBody: string, signature: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  return safeEqualHex(hmacHex(secret, rawBody), signature.trim());
}

/** Razorpay Checkout handler response: HMAC_SHA256(keySecret, order_id + "|" + payment_id). */
export function verifyRazorpayPayment(orderId: string, paymentId: string, signature: string | null | undefined, keySecret: string | undefined): boolean {
  if (!keySecret || !signature || !orderId || !paymentId) return false;
  return safeEqualHex(hmacHex(keySecret, `${orderId}|${paymentId}`), signature.trim());
}

/** Parses "t=123,v1=abc,v1=def,v0=..." into the timestamp and all v1 signatures. */
export function parseStripeHeader(header: string): { t: number | null; v1: string[] } {
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t" && /^\d{1,12}$/.test(v)) t = Number(v);
    else if (k === "v1") v1.push(v);
  }
  return { t, v1 };
}

/**
 * Stripe webhook: Stripe-Signature "t=<unix secs>,v1=<hex>"; v1 = HMAC_SHA256(secret, `${t}.${rawBody}`).
 * Rejects timestamps further than `toleranceSec` (default 5 minutes) from `nowMs`, in either direction.
 */
export function verifyStripeWebhook(
  rawBody: string,
  header: string | null | undefined,
  secret: string | undefined,
  nowMs: number = Date.now(),
  toleranceSec = 300
): boolean {
  if (!secret || !header) return false;
  const { t, v1 } = parseStripeHeader(header);
  if (t === null || v1.length === 0) return false;
  if (Math.abs(nowMs / 1000 - t) > toleranceSec) return false;
  const expected = hmacHex(secret, `${t}.${rawBody}`);
  let ok = false;
  for (const sig of v1) if (safeEqualHex(expected, sig)) ok = true;
  return ok;
}

/** Constant-time check of "Authorization: Bearer <secret>" (used by the cron endpoint). */
export function verifyBearer(header: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return false;
  // Hash both sides so lengths are equal for timingSafeEqual.
  const a = createHmac("sha256", "bearer").update(m[1]).digest();
  const b = createHmac("sha256", "bearer").update(secret).digest();
  return timingSafeEqual(a, b);
}
