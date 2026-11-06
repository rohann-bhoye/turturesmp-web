// Run: npx tsx scripts/test-checkout.ts
// Tests the pure checkout logic only (signatures, coupons, validation). No database, no gateway access.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyBearer, verifyRazorpayPayment, verifyRazorpayWebhook, verifyStripeWebhook } from "../src/server/checkout/signatures";
import { applyCoupon } from "../src/server/checkout/coupon";
import { MIN_TOTAL, formatMoney, makeOrderNo, ORDER_NO_RE, normalizeCouponCode, validateMcName } from "../src/server/checkout/validate";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log("  ok   " + name);
  } catch (e) {
    console.error("  FAIL " + name);
    console.error(e);
    process.exitCode = 1;
  }
}
const hmac = (s: string, d: string) => createHmac("sha256", s).update(d).digest("hex");

// ---------- Razorpay ----------
const rzSecret = "whsec_razor_test";
const rzBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 39900, currency: "INR" } } } });
test("razorpay webhook: good signature", () => assert.equal(verifyRazorpayWebhook(rzBody, hmac(rzSecret, rzBody), rzSecret), true));
test("razorpay webhook: tampered body", () => assert.equal(verifyRazorpayWebhook(rzBody.replace("39900", "100"), hmac(rzSecret, rzBody), rzSecret), false));
test("razorpay webhook: wrong secret", () => assert.equal(verifyRazorpayWebhook(rzBody, hmac("other", rzBody), rzSecret), false));
test("razorpay webhook: missing/garbage signature or secret", () => {
  assert.equal(verifyRazorpayWebhook(rzBody, null, rzSecret), false);
  assert.equal(verifyRazorpayWebhook(rzBody, "", rzSecret), false);
  assert.equal(verifyRazorpayWebhook(rzBody, "zz-not-hex", rzSecret), false);
  assert.equal(verifyRazorpayWebhook(rzBody, "abcd", rzSecret), false); // wrong length
  assert.equal(verifyRazorpayWebhook(rzBody, hmac(rzSecret, rzBody), undefined), false);
});
test("razorpay checkout payment signature", () => {
  const sig = hmac("key_secret", "order_1|pay_1");
  assert.equal(verifyRazorpayPayment("order_1", "pay_1", sig, "key_secret"), true);
  assert.equal(verifyRazorpayPayment("order_1", "pay_2", sig, "key_secret"), false);
  assert.equal(verifyRazorpayPayment("order_1", "pay_1", sig, undefined), false);
});

// ---------- Stripe ----------
const stSecret = "whsec_stripe_test";
const stBody = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_1", amount_total: 499, currency: "usd", payment_status: "paid" } } });
const now = Date.UTC(2026, 10, 6, 12, 0, 0);
const t = Math.floor(now / 1000);
const stHeader = (ts: number, body = stBody, secret = stSecret) => `t=${ts},v1=${hmac(secret, `${ts}.${body}`)}`;
test("stripe webhook: good signature", () => assert.equal(verifyStripeWebhook(stBody, stHeader(t), stSecret, now), true));
test("stripe webhook: tampered body", () => assert.equal(verifyStripeWebhook(stBody.replace("499", "1"), stHeader(t), stSecret, now), false));
test("stripe webhook: wrong secret", () => assert.equal(verifyStripeWebhook(stBody, stHeader(t, stBody, "nope"), stSecret, now), false));
test("stripe webhook: stale timestamp (6 min old)", () => assert.equal(verifyStripeWebhook(stBody, stHeader(t - 360), stSecret, now), false));
test("stripe webhook: timestamp from the future (6 min)", () => assert.equal(verifyStripeWebhook(stBody, stHeader(t + 360), stSecret, now), false));
test("stripe webhook: within tolerance (4 min old)", () => assert.equal(verifyStripeWebhook(stBody, stHeader(t - 240), stSecret, now), true));
test("stripe webhook: timestamp swapped after signing", () => {
  const h = `t=${t - 10},v1=${hmac(stSecret, `${t}.${stBody}`)}`;
  assert.equal(verifyStripeWebhook(stBody, h, stSecret, now), false);
});
test("stripe webhook: multiple v1 (rotation) accepts if any matches", () => {
  const h = `t=${t},v1=${"0".repeat(64)},v1=${hmac(stSecret, `${t}.${stBody}`)},v0=deadbeef`;
  assert.equal(verifyStripeWebhook(stBody, h, stSecret, now), true);
});
test("stripe webhook: malformed headers", () => {
  for (const h of ["", "garbage", "t=abc,v1=00", `v1=${hmac(stSecret, `${t}.${stBody}`)}`, `t=${t}`, null, undefined]) {
    assert.equal(verifyStripeWebhook(stBody, h as string, stSecret, now), false);
  }
  assert.equal(verifyStripeWebhook(stBody, stHeader(t), undefined, now), false);
});

// ---------- cron bearer ----------
test("cron bearer", () => {
  assert.equal(verifyBearer("Bearer s3cret", "s3cret"), true);
  assert.equal(verifyBearer("Bearer s3cret!", "s3cret"), false);
  assert.equal(verifyBearer("s3cret", "s3cret"), false);
  assert.equal(verifyBearer(null, "s3cret"), false);
  assert.equal(verifyBearer("Bearer x", undefined), false);
  assert.equal(verifyBearer("Bearer ", ""), false);
});

// ---------- coupons (amounts in paise / cents) ----------
const base = { code: "SAVE", active: true };
const apply = (coupon: Parameters<typeof applyCoupon>[0]["coupon"], extra: Partial<Parameters<typeof applyCoupon>[0]> = {}) =>
  applyCoupon({ coupon, subtotal: 79900, currency: "INR", productSlug: "gold", now: new Date("2026-11-06T00:00:00Z"), ...extra });

test("coupon: percent", () => assert.deepEqual(apply({ ...base, percentOff: 25 }), { ok: true, discount: 19975, total: 59925 }));
test("coupon: percent rounds down the discount", () => {
  const r = apply({ ...base, percentOff: 33 }, { subtotal: 999 });
  assert.deepEqual(r, { ok: true, discount: 329, total: 670 });
});
test("coupon: fixed amount per currency", () => {
  const c = { ...base, amountOff: { inr: 10000, usd: 200 } };
  assert.deepEqual(apply(c), { ok: true, discount: 10000, total: 69900 });
  assert.deepEqual(apply(c, { currency: "USD", subtotal: 999 }), { ok: true, discount: 200, total: 799 });
});
test("coupon: fixed amount not defined for the currency", () => {
  const r = apply({ ...base, amountOff: { inr: 10000 } }, { currency: "USD", subtotal: 999 });
  assert.equal(r.ok, false);
});
test("coupon: never below 0", () => {
  assert.deepEqual(apply({ ...base, amountOff: { inr: 999999 } }), { ok: true, discount: 79900, total: 0 });
  assert.deepEqual(apply({ ...base, percentOff: 150 }), { ok: true, discount: 79900, total: 0 });
});
test("coupon: percent then fixed", () => assert.deepEqual(apply({ ...base, percentOff: 50, amountOff: { inr: 5000 } }, { subtotal: 20000 }), { ok: true, discount: 15000, total: 5000 }));
test("coupon: inactive / missing", () => {
  assert.equal(apply({ ...base, percentOff: 10, active: false }).ok, false);
  assert.equal(apply(null).ok, false);
});
test("coupon: expiry", () => {
  assert.equal(apply({ ...base, percentOff: 10, expiresAt: new Date("2026-11-05T00:00:00Z") }).ok, false);
  assert.equal(apply({ ...base, percentOff: 10, expiresAt: new Date("2026-11-07T00:00:00Z") }).ok, true);
});
test("coupon: maxUses", () => {
  assert.equal(apply({ ...base, percentOff: 10, maxUses: 5, used: 5 }).ok, false);
  assert.equal(apply({ ...base, percentOff: 10, maxUses: 5, used: 4 }).ok, true);
  assert.equal(apply({ ...base, percentOff: 10, maxUses: null, used: 999 }).ok, true);
});
test("coupon: product scope", () => {
  assert.equal(apply({ ...base, percentOff: 10, productSlugs: ["iron", "diamond"] }).ok, false);
  assert.equal(apply({ ...base, percentOff: 10, productSlugs: ["Gold"] }).ok, true);
  assert.equal(apply({ ...base, percentOff: 10, productSlugs: [] }).ok, true);
});
test("coupon: no discount configured", () => assert.equal(apply({ ...base }).ok, false));

// ---------- validation / formatting ----------
test("java username", () => {
  for (const n of ["Steve", "a_b", "Abc123_XYZ", "A".repeat(16), " Steve "]) assert.ok(validateMcName(n, "java"), n);
  for (const n of ["ab", "A".repeat(17), "has space", ".Dot", "bad-name", "ünï", "", "x;y"]) assert.equal(validateMcName(n, "java"), null, n);
  assert.equal(validateMcName(" Steve ", "java"), "Steve");
  assert.equal(validateMcName(123, "java"), null);
});
test("bedrock username", () => {
  for (const n of [".Steve", "Steve Jobs", "Abc", ".abc", "My Gamertag1"]) assert.ok(validateMcName(n, "bedrock"), n);
  for (const n of ["..Steve", "ab", "bad-name", "A".repeat(18), "Name!"]) assert.equal(validateMcName(n, "bedrock"), null, n);
});
test("order number format", () => {
  const no = makeOrderNo(new Date("2026-11-06T10:00:00Z"));
  assert.match(no, ORDER_NO_RE);
  assert.ok(no.startsWith("TSMP-20261106-"));
  assert.equal(makeOrderNo(new Date("2026-01-02T00:00:00Z"), () => 0), "TSMP-20260102-AAAA");
});
test("coupon code normalisation", () => {
  assert.equal(normalizeCouponCode("  summer10 "), "SUMMER10");
  assert.equal(normalizeCouponCode(undefined), "");
});
test("money formatting and minimums", () => {
  assert.equal(formatMoney(39900, "INR"), "₹399");
  assert.equal(formatMoney(159900, "INR"), "₹1,599");
  assert.equal(formatMoney(499, "USD"), "$4.99");
  assert.equal(formatMoney(1999, "USD"), "$19.99");
  assert.deepEqual(MIN_TOTAL, { INR: 100, USD: 50 });
});

console.log(`\n${passed} tests passed${process.exitCode ? ", SOME FAILED" : ""}`);
