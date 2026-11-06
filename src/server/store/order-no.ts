import { randomInt } from "node:crypto";
import { connectDB } from "@/server/db";
import { Order } from "@/server/models/Store";

// No 0/O, 1/I/L so an order number can be read out loud or typed from a screenshot.
export const ORDER_NO_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** TSMP-YYYYMMDD-XXXX (date in UTC). */
export function makeOrderNo(now: Date = new Date(), pick: (n: number) => number = randomInt): string {
  const d = now.toISOString().slice(0, 10).replace(/-/g, "");
  let tail = "";
  for (let i = 0; i < 4; i++) tail += ORDER_NO_ALPHABET[pick(ORDER_NO_ALPHABET.length)];
  return `TSMP-${d}-${tail}`;
}

/**
 * Creates an order with a fresh order number. The unique index on orderNo is the real guard:
 * on a duplicate-key error a new number is drawn (up to 10 times).
 */
export async function createOrder(data: Record<string, unknown>) {
  await connectDB();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await Order.create({ ...data, orderNo: makeOrderNo() });
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e;
    }
  }
  throw new Error("Could not generate a unique order number.");
}
