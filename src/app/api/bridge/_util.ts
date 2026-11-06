import { isIP } from "node:net";
import { connectDB } from "@/server/db";
import { Order } from "@/server/models";
import { verifyBridgeRequest } from "@/server/bridge-auth";

// Shared helpers for the /api/bridge/* routes. Never trust anything in a request body.

export const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const bad = (error: string, status = 400) => json({ ok: false, error }, status);

/** Verifies the signature, connects to Mongo, runs the handler, and turns crashes into a generic 500. */
export async function handle(req: Request, fn: (body: any) => Promise<Response>): Promise<Response> {
  const auth = await verifyBridgeRequest(req);
  if (!auth.ok) return auth.res;
  try {
    await connectDB();
    return await fn(auth.body);
  } catch (e) {
    console.error("bridge route failed", e);
    return bad("Internal error", 500);
  }
}

export const isObj = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Trimmed string without control characters, cut to `max`. Returns "" for non-strings. */
export function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

/** Accepts dashed or plain 32-hex UUIDs; returns lowercase dashed, or null. */
export function uuid(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const h = v.trim().toLowerCase().replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/.test(h)) return null;
  if (v.includes("-") && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim())) return null;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const playerName = (v: unknown) => str(v, 32);
export const edition = (v: unknown): "java" | "bedrock" => (v === "bedrock" ? "bedrock" : "java");

/** Finite number clamped to [min, max] (rounded when `int`), or undefined if it is not a number. */
export function num(v: unknown, min: number, max: number, int = true): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const c = Math.min(max, Math.max(min, v));
  return int ? Math.round(c) : c;
}

export const ip = (v: unknown): string | undefined => {
  const s = str(v, 45);
  return s && isIP(s) ? s : undefined;
};

/** Parses an ISO date string. undefined = absent, null = present but invalid. */
export function isoDate(v: unknown): Date | undefined | null {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || v.length > 40) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** Adds a line to an order's delivery log. Never throws. */
export async function logDelivery(orderId: unknown, step: string, ok: boolean, message?: string) {
  if (!orderId) return;
  try {
    await Order.updateOne({ _id: orderId }, { $push: { deliveryLog: { at: new Date(), step, ok, message: message ?? (ok ? "done" : "failed") } } });
  } catch (e) {
    console.error("bridge: could not write order deliveryLog", e);
  }
}
