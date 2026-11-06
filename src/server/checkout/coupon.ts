// Pure coupon logic. The caller loads the coupon and product from the database; nothing here trusts the browser.
import type { Currency } from "./validate";

export type CouponLike = {
  code: string;
  percentOff?: number | null;
  amountOff?: { inr?: number | null; usd?: number | null } | null;
  maxUses?: number | null;
  used?: number | null;
  expiresAt?: Date | string | null;
  productSlugs?: string[] | null;
  active?: boolean | null;
};

export type CouponResult = { ok: true; discount: number; total: number } | { ok: false; error: string };

/** subtotal is in the smallest currency unit. Percent applies first, then the fixed amount; total never goes below 0. */
export function applyCoupon(opts: {
  coupon: CouponLike | null | undefined;
  subtotal: number;
  currency: Currency;
  productSlug: string;
  now?: Date;
}): CouponResult {
  const { coupon, subtotal, currency, productSlug } = opts;
  const now = opts.now ?? new Date();
  if (!coupon || coupon.active === false) return { ok: false, error: "This coupon code is not valid." };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now.getTime()) return { ok: false, error: "This coupon has expired." };
  if (coupon.maxUses != null && (coupon.used ?? 0) >= coupon.maxUses) return { ok: false, error: "This coupon has been used up." };
  const scope = coupon.productSlugs ?? [];
  if (scope.length > 0 && !scope.map((s) => s.toLowerCase()).includes(productSlug.toLowerCase())) {
    return { ok: false, error: "This coupon does not apply to this product." };
  }
  const pct = coupon.percentOff && coupon.percentOff > 0 ? Math.min(100, coupon.percentOff) : 0;
  const fixed = Math.max(0, (currency === "INR" ? coupon.amountOff?.inr : coupon.amountOff?.usd) ?? 0);
  if (pct === 0 && fixed === 0) return { ok: false, error: `This coupon is not valid for ${currency} payments.` };
  const afterPct = subtotal - Math.floor((subtotal * pct) / 100);
  const total = Math.max(0, afterPct - Math.floor(fixed));
  return { ok: true, discount: subtotal - total, total };
}
