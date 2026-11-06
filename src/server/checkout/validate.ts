// Pure input validation and formatting helpers for checkout.
export type Edition = "java" | "bedrock";
export type Currency = "INR" | "USD";

const JAVA_RE = /^[A-Za-z0-9_]{3,16}$/;
const BEDROCK_RE = /^\.?[A-Za-z0-9_ ]{3,16}$/;

export function isEdition(v: unknown): v is Edition {
  return v === "java" || v === "bedrock";
}
export function isCurrency(v: unknown): v is Currency {
  return v === "INR" || v === "USD";
}

/** Returns the cleaned name, or null when it is not a valid Minecraft name for that edition. */
export function validateMcName(raw: unknown, edition: Edition): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return (edition === "bedrock" ? BEDROCK_RE : JAVA_RE).test(name) ? name : null;
}

export function normalizeCouponCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase().slice(0, 40) : "";
}

const ORDER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** TSMP-YYYYMMDD-XXXX (UTC date). `rand` returns a number in [0,1); injectable for tests. */
export function makeOrderNo(now: Date = new Date(), rand: () => number = Math.random): string {
  const d = now.toISOString().slice(0, 10).replace(/-/g, "");
  let s = "";
  for (let i = 0; i < 4; i++) s += ORDER_ALPHABET[Math.floor(rand() * ORDER_ALPHABET.length)];
  return `TSMP-${d}-${s}`;
}

export const ORDER_NO_RE = /^TSMP-\d{8}-[A-Z0-9]{4}$/;

/** Amounts are in the smallest unit (paise / cents). */
export function formatMoney(minor: number, currency: Currency): string {
  const major = minor / 100;
  const whole = Number.isInteger(major);
  if (currency === "INR") {
    return "₹" + major.toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  }
  return "$" + major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Smallest totals the gateways accept: Razorpay Re 1, Stripe $0.50. */
export const MIN_TOTAL: Record<Currency, number> = { INR: 100, USD: 50 };
