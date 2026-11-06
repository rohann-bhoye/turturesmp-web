// Run: npx tsx scripts/test-pricing.ts
// Tests the pure store helpers (money, coupons, expiry, command safety, order numbers). No database needed.
import assert from "node:assert/strict";
import { applyCoupon, computeExpiry, computeTotals, effectiveExpiry, formatMoney, parseMoney, toMajorInput, type CartLine } from "../src/server/store/pricing";
import { renderCommand, validateCommandTemplate } from "../src/server/store/commands";
import { makeOrderNo, ORDER_NO_ALPHABET } from "../src/server/store/order-no";

let passed = 0;
function t(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log("  ok  ", name);
  } catch (e) {
    console.error("  FAIL", name, "\n", e);
    process.exitCode = 1;
  }
}

const NOW = new Date("2026-11-06T12:00:00Z");
const cart: CartLine[] = [
  { slug: "gold", unitPrice: 79900, qty: 1 },
  { slug: "tag-legend", unitPrice: 19900, qty: 2 },
];

console.log("money");
t("parseMoney whole and decimals", () => {
  assert.equal(parseMoney("399"), 39900);
  assert.equal(parseMoney("9.99"), 999);
  assert.equal(parseMoney("9.9"), 990);
  assert.equal(parseMoney("0"), 0);
  assert.equal(parseMoney("19.99"), 1999);
  assert.equal(parseMoney("1.1"), 110);
});
t("parseMoney strips symbols and commas", () => {
  assert.equal(parseMoney("₹1,599"), 159900);
  assert.equal(parseMoney(" $ 4.99 "), 499);
});
t("parseMoney rejects bad input", () => {
  for (const bad of ["", "abc", "-5", "1.234", "1e3", "12.", ".5", "99999999999", "NaN"]) assert.equal(parseMoney(bad), null, bad);
});
t("parseMoney has no float drift (0.29 * 100 style cases)", () => {
  assert.equal(parseMoney("0.29"), 29);
  assert.equal(parseMoney("4.35"), 435);
  assert.equal(parseMoney("1.15"), 115);
});
t("formatMoney", () => {
  assert.equal(formatMoney(159900, "INR"), "₹1,599");
  assert.equal(formatMoney(9999999, "INR"), "₹99,999.99");
  assert.equal(formatMoney(12345600, "INR"), "₹1,23,456");
  assert.equal(formatMoney(1999, "USD"), "$19.99");
  assert.equal(formatMoney(500, "USD"), "$5");
  assert.equal(formatMoney(0, "INR"), "₹0");
  assert.equal(formatMoney(undefined, "USD"), "$0");
});
t("toMajorInput round trips", () => {
  assert.equal(toMajorInput(39900), "399");
  assert.equal(toMajorInput(999), "9.99");
  assert.equal(parseMoney(toMajorInput(1990)), 1990);
  assert.equal(toMajorInput(null), "");
});

console.log("coupons");
t("percent discount", () => {
  const r = applyCoupon({ code: "X", percentOff: 10 }, cart, "INR", NOW);
  assert.deepEqual(r, { ok: true, discount: 11970, eligible: 119700 });
});
t("percent floors to a whole minor unit", () => {
  const r = applyCoupon({ percentOff: 33.33 }, [{ slug: "a", unitPrice: 999, qty: 1 }], "USD", NOW);
  assert.equal(r.ok && r.discount, 332);
});
t("fixed amount per currency", () => {
  const c = { amountOff: { inr: 10000, usd: 150 } };
  assert.equal(applyCoupon(c, cart, "INR", NOW).ok && (applyCoupon(c, cart, "INR", NOW) as { discount: number }).discount, 10000);
  const usd = applyCoupon(c, cart, "USD", NOW);
  assert.equal(usd.ok && usd.discount, 150);
});
t("fixed amount missing for a currency is rejected", () => {
  const r = applyCoupon({ amountOff: { inr: 5000 } }, cart, "USD", NOW);
  assert.equal(r.ok, false);
});
t("never below zero: discount capped at the eligible total", () => {
  const r = applyCoupon({ amountOff: { inr: 999999 } }, cart, "INR", NOW);
  assert.ok(r.ok && r.discount === 119700);
  const totals = computeTotals(cart, r.ok ? r.discount : 0);
  assert.equal(totals.total, 0);
  assert.equal(computeTotals(cart, 10 ** 9).total, 0);
  const p = applyCoupon({ percentOff: 100, amountOff: { inr: 5000 } }, cart, "INR", NOW);
  assert.ok(p.ok && p.discount === 119700);
});
t("percent over 100 is clamped", () => {
  const r = applyCoupon({ percentOff: 250 }, cart, "INR", NOW);
  assert.ok(r.ok && r.discount === 119700);
});
t("product scope limits the eligible amount", () => {
  const r = applyCoupon({ percentOff: 50, productSlugs: ["Tag-Legend"] }, cart, "INR", NOW);
  assert.deepEqual(r, { ok: true, discount: 19900, eligible: 39800 });
});
t("product scope with no matching item is rejected", () => {
  const r = applyCoupon({ percentOff: 50, productSlugs: ["diamond"] }, cart, "INR", NOW);
  assert.equal(r.ok, false);
});
t("expired, inactive, used up, unknown", () => {
  assert.equal(applyCoupon({ percentOff: 10, expiresAt: new Date("2026-11-06T11:59:59Z") }, cart, "INR", NOW).ok, false);
  assert.equal(applyCoupon({ percentOff: 10, expiresAt: new Date("2026-11-07T00:00:00Z") }, cart, "INR", NOW).ok, true);
  assert.equal(applyCoupon({ percentOff: 10, active: false }, cart, "INR", NOW).ok, false);
  assert.equal(applyCoupon({ percentOff: 10, maxUses: 5, used: 5 }, cart, "INR", NOW).ok, false);
  assert.equal(applyCoupon({ percentOff: 10, maxUses: 5, used: 4 }, cart, "INR", NOW).ok, true);
  assert.equal(applyCoupon(null, cart, "INR", NOW).ok, false);
});
t("coupon with no discount defined is rejected; empty cart is rejected", () => {
  assert.equal(applyCoupon({ code: "EMPTY" }, cart, "INR", NOW).ok, false);
  assert.equal(applyCoupon({ percentOff: 10 }, [], "INR", NOW).ok, false);
});
t("totals", () => {
  assert.deepEqual(computeTotals(cart, 11970), { subtotal: 119700, discount: 11970, total: 107730 });
  assert.deepEqual(computeTotals(cart, -5), { subtotal: 119700, discount: 0, total: 119700 });
});

console.log("entitlement expiry");
t("permanent when no duration", () => {
  assert.equal(computeExpiry({ now: NOW }).expiresAt, null);
  assert.equal(computeExpiry({ now: NOW, durationDays: 0 }).expiresAt, null);
});
t("timed from now, multiplied by qty", () => {
  assert.equal(computeExpiry({ now: NOW, durationDays: 30 }).expiresAt?.toISOString(), "2026-12-06T12:00:00.000Z");
  assert.equal(computeExpiry({ now: NOW, durationDays: 30, qty: 2 }).expiresAt?.toISOString(), "2027-01-05T12:00:00.000Z");
});
t("renewal chains after a future expiry, ignores a past one", () => {
  const future = new Date("2026-11-20T12:00:00Z");
  assert.equal(computeExpiry({ now: NOW, durationDays: 10, chainFrom: future }).expiresAt?.toISOString(), "2026-11-30T12:00:00.000Z");
  const past = new Date("2026-11-01T12:00:00Z");
  assert.equal(computeExpiry({ now: NOW, durationDays: 10, chainFrom: past }).expiresAt?.toISOString(), "2026-11-16T12:00:00.000Z");
});
t("effectiveExpiry", () => {
  const a = new Date("2026-12-01T00:00:00Z");
  const b = new Date("2027-01-01T00:00:00Z");
  assert.equal(effectiveExpiry([]), null);
  assert.equal(effectiveExpiry([{ expiresAt: a }, { expiresAt: b }])?.toISOString(), b.toISOString());
  assert.equal(effectiveExpiry([{ expiresAt: a }, { expiresAt: null }]), null);
});

console.log("commands");
t("renders placeholders and strips slash", () => {
  const r = renderCommand("/give {player} diamond 5 # {uuid}", { player: "Steve", uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5" });
  assert.deepEqual(r, { ok: true, command: "give Steve diamond 5 # 069a79f4-44e9-4726-a5be-fca90e38aaf5" });
});
t("refuses newline and semicolon", () => {
  assert.ok(validateCommandTemplate("say hi\nop Steve"));
  assert.ok(validateCommandTemplate("say hi; op Steve"));
  assert.ok(validateCommandTemplate("say hi\rop"));
  assert.equal(renderCommand("say hi; op x", { player: "Steve", uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5" }).ok, false);
  assert.equal(validateCommandTemplate("give {player} diamond 5"), null);
});
t("refuses unsafe player names and empty commands", () => {
  const uuid = "069a79f4-44e9-4726-a5be-fca90e38aaf5";
  assert.equal(renderCommand("say {player}", { player: "a;op b", uuid }).ok, false);
  assert.equal(renderCommand("say {player}", { player: "Steve\nop x", uuid }).ok, false);
  assert.equal(renderCommand("say {player}", { player: "Steve", uuid: "nope" }).ok, false);
  assert.ok(validateCommandTemplate("  / "));
  assert.ok(validateCommandTemplate("x".repeat(300)));
});

console.log("order numbers");
t("format and alphabet", () => {
  for (let i = 0; i < 200; i++) {
    const no = makeOrderNo(NOW);
    assert.match(no, /^TSMP-20261106-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
  }
  assert.ok(!/[0O1IL]/.test(ORDER_NO_ALPHABET));
});
t("deterministic with injected random", () => {
  assert.equal(makeOrderNo(NOW, () => 0), "TSMP-20261106-AAAA");
  assert.equal(makeOrderNo(NOW, (n) => n - 1), "TSMP-20261106-9999");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with FAILURES above)" : ""}`);
