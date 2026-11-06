// Pure store helpers: money in minor units (paise / cents), coupons and entitlement dates.
// No database or framework imports, so it runs anywhere (and in scripts/test-pricing.ts).

export type Currency = "INR" | "USD";
export const CURRENCIES: readonly Currency[] = ["INR", "USD"];
export const isCurrency = (v: unknown): v is Currency => v === "INR" || v === "USD";
export const CURRENCY_SYMBOL: Record<Currency, string> = { INR: "₹", USD: "$" };

const MAX_MAJOR = 10_000_000; // sanity cap: 10 million rupees / dollars

/**
 * "399" -> 39900, "9.99" -> 999, "₹1,599.5" -> 159950. Returns null for anything else
 * (negative, text, more than 2 decimals). Integer maths only, no float rounding errors.
 */
export function parseMoney(input: unknown): number | null {
  const s = String(input ?? "").replace(/[₹$,\s]/g, "");
  const m = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const whole = Number(m[1]);
  if (whole > MAX_MAJOR) return null;
  const frac = Number((m[2] ?? "").padEnd(2, "0") || "0");
  return whole * 100 + frac;
}

/** 159900 + "INR" -> "₹1,599", 99900 + "USD" -> "$999", 999 + "USD" -> "$9.99". */
export function formatMoney(minor: number | null | undefined, currency: Currency): string {
  const n = Math.round(Number(minor) || 0);
  const abs = Math.abs(n);
  const major = abs / 100;
  const text = major.toLocaleString(currency === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: abs % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return (n < 0 ? "-" : "") + CURRENCY_SYMBOL[currency] + text;
}

/** Value for an <input> showing a price in major units: 39900 -> "399", 999 -> "9.99". */
export function toMajorInput(minor: number | null | undefined): string {
  if (minor == null || !Number.isFinite(minor)) return "";
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

// ---------- coupons ----------
export type CouponLike = {
  code?: string;
  percentOff?: number | null;
  amountOff?: { inr?: number | null; usd?: number | null } | null;
  maxUses?: number | null;
  used?: number | null;
  expiresAt?: Date | string | null;
  productSlugs?: string[] | null;
  active?: boolean | null;
};
export type CartLine = { slug: string; unitPrice: number; qty: number };
export type CouponResult = { ok: true; discount: number; eligible: number } | { ok: false; error: string };

export const normalizeCouponCode = (v: unknown) => String(v ?? "").trim().toUpperCase();

export const lineTotal = (l: CartLine) => Math.max(0, Math.round(l.unitPrice)) * Math.max(0, Math.floor(l.qty));
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((sum, l) => sum + lineTotal(l), 0);

/**
 * Validates a coupon against a cart and returns the discount in minor units.
 * Checks: active, expiry, max uses, product scope, currency. The discount only ever
 * applies to eligible lines and is capped at their total, so the order total never goes below 0.
 * A coupon may carry a percentage and/or a fixed amount for the order currency; both are added.
 */
export function applyCoupon(coupon: CouponLike | null | undefined, lines: CartLine[], currency: Currency, now: Date = new Date()): CouponResult {
  if (!coupon) return { ok: false, error: "This coupon code does not exist." };
  if (coupon.active === false) return { ok: false, error: "This coupon is not active." };
  if (coupon.expiresAt) {
    const exp = new Date(coupon.expiresAt).getTime();
    if (!Number.isNaN(exp) && exp <= now.getTime()) return { ok: false, error: "This coupon has expired." };
  }
  if (coupon.maxUses != null && (coupon.used ?? 0) >= coupon.maxUses) return { ok: false, error: "This coupon has reached its usage limit." };

  const scope = (coupon.productSlugs ?? []).map((s) => s.toLowerCase());
  const eligible = cartSubtotal(scope.length ? lines.filter((l) => scope.includes(l.slug.toLowerCase())) : lines);
  if (eligible <= 0) return { ok: false, error: "This coupon does not apply to the items in your cart." };

  const pct = Math.min(100, Math.max(0, Number(coupon.percentOff) || 0));
  const fixed = Math.max(0, Math.floor(Number(currency === "INR" ? coupon.amountOff?.inr : coupon.amountOff?.usd) || 0));
  if (pct <= 0 && fixed <= 0) return { ok: false, error: `This coupon is not valid for ${currency} orders.` };

  // pct has at most 2 decimals, so eligible * pct * 100 is an integer: no float drift before the floor.
  const byPercent = Math.floor(Math.round(eligible * pct * 100) / 10000);
  const discount = Math.min(eligible, byPercent + fixed);
  return { ok: true, discount, eligible };
}

export function computeTotals(lines: CartLine[], discount: number) {
  const subtotal = cartSubtotal(lines);
  const d = Math.min(subtotal, Math.max(0, Math.floor(discount) || 0));
  return { subtotal, discount: d, total: subtotal - d };
}

// ---------- entitlement dates ----------
export const addDays = (from: Date, days: number) => new Date(from.getTime() + days * 864e5);

/**
 * Window for a newly bought product. No durationDays = permanent (expiresAt null).
 * chainFrom is the latest expiry of an already active copy of the same product: the new
 * time is added after it (renewal), as long as it is still in the future.
 */
export function computeExpiry(opts: { now: Date; durationDays?: number | null; qty?: number; chainFrom?: Date | null }) {
  const days = Number(opts.durationDays);
  if (!Number.isFinite(days) || days <= 0) return { startsAt: opts.now, expiresAt: null as Date | null };
  const qty = Math.max(1, Math.floor(opts.qty ?? 1));
  const base = opts.chainFrom && opts.chainFrom.getTime() > opts.now.getTime() ? opts.chainFrom : opts.now;
  return { startsAt: opts.now, expiresAt: addDays(base, days * qty) };
}

/** Effective expiry across several active entitlements: null (permanent) if any is permanent, else the latest. */
export function effectiveExpiry(list: { expiresAt?: Date | null }[]): Date | null {
  if (!list.length || list.some((e) => !e.expiresAt)) return null;
  return list.reduce((max, e) => (e.expiresAt! > max ? e.expiresAt! : max), list[0].expiresAt!);
}
