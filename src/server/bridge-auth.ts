import { createHmac, timingSafeEqual } from "node:crypto";

// Verifies requests from the TurtureBridge plugin. See docs/BRIDGE_API.md.
// Kept free of Next/Mongo imports so it can be unit tested with plain `npx tsx`.

export const MAX_SKEW_MS = 5 * 60 * 1000;
export const MAX_BODY_BYTES = 1_000_000;

type Fail = { ok: false; res: Response };
export type BridgeAuthResult = { ok: true; body: any } | Fail;

const fail = (status: number, error: string): Fail => ({
  ok: false,
  res: Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } }),
});

/** Lowercase hex of HMAC_SHA256(secret, timestamp + "." + rawBody). */
export function computeSignature(secret: string, timestamp: string, rawBody: Uint8Array | string): string {
  return createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex");
}

/** Constant-time check. A malformed or wrong-length signature simply returns false. */
export function signatureMatches(secret: string, timestamp: string, rawBody: Uint8Array | string, signature: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(computeSignature(secret, timestamp, rawBody), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function verifyBridgeRequest(req: Request): Promise<BridgeAuthResult> {
  const secret = process.env.BRIDGE_SECRET;
  if (!secret) return fail(503, "Bridge is not configured on the website (BRIDGE_SECRET is unset).");

  const timestamp = req.headers.get("x-timestamp")?.trim() ?? "";
  const signature = req.headers.get("x-signature")?.trim() ?? "";
  if (!timestamp || !signature) return fail(401, "Missing X-Timestamp or X-Signature header.");
  if (!/^\d{10,16}$/.test(timestamp)) return fail(401, "Invalid X-Timestamp.");
  if (Math.abs(Date.now() - Number(timestamp)) > MAX_SKEW_MS) return fail(401, "Timestamp is more than 5 minutes off. Check the server clock.");

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return fail(413, "Request body too large.");

  // Read the body once, as raw bytes: the signature covers exactly what the plugin sent.
  const raw = Buffer.from(await req.arrayBuffer());
  if (raw.length > MAX_BODY_BYTES) return fail(413, "Request body too large.");

  if (!signatureMatches(secret, timestamp, raw, signature)) return fail(401, "Bad signature.");

  if (raw.length === 0) return { ok: true, body: {} };
  try {
    return { ok: true, body: JSON.parse(raw.toString("utf8")) };
  } catch {
    return fail(400, "Body is not valid JSON.");
  }
}
