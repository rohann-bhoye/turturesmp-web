// Run with:  npx tsx scripts/test-bridge-auth.ts
// Signs requests the way the TurtureBridge plugin does (HMAC-SHA256 over "timestamp.rawBody", hex)
// and checks verifyBridgeRequest. Pure logic: no database needed.
import { createHmac } from "node:crypto";
import { verifyBridgeRequest } from "../src/server/bridge-auth";

const SECRET = "test-secret-0123456789abcdef";
process.env.BRIDGE_SECRET = SECRET;

// Independent signer, deliberately not using the code under test.
const sign = (secret: string, ts: string, body: string) => createHmac("sha256", secret).update(ts + "." + body).digest("hex");

function req(opts: { method?: string; body?: string; ts?: string; sig?: string; secret?: string; headers?: Record<string, string> }) {
  const method = opts.method ?? "POST";
  const body = opts.body ?? "";
  const ts = opts.ts ?? String(Date.now());
  const sig = opts.sig ?? sign(opts.secret ?? SECRET, ts, body);
  return new Request("http://localhost/api/bridge/test", {
    method,
    body: method === "GET" ? undefined : body,
    headers: { "X-Timestamp": ts, "X-Signature": sig, "Content-Type": "application/json", ...opts.headers },
  });
}

let failed = 0;
async function check(name: string, r: Request, expectOk: boolean, expectStatus?: number, expectBody?: unknown) {
  const out = await verifyBridgeRequest(r);
  let pass = out.ok === expectOk;
  if (!out.ok && expectStatus !== undefined) pass &&= out.res.status === expectStatus;
  if (out.ok && expectBody !== undefined) pass &&= JSON.stringify(out.body) === JSON.stringify(expectBody);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${out.ok ? "" : `  (-> ${out.res.status})`}`);
  if (!pass) failed++;
}

async function main() {
  const body = JSON.stringify({ version: "1.0.0", online: [{ uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5", name: "Notch", edition: "java" }] });
  const now = Date.now();

  await check("good signature passes", req({ body }), true, undefined, JSON.parse(body));
  await check("good signature with unicode body passes", req({ body: JSON.stringify({ name: "Zoë ✓ 日本" }) }), true);
  await check("GET with empty body passes", req({ method: "GET" }), true, undefined, {});
  await check("tampered body fails", req({ body: body.replace("Notch", "Hacker"), sig: sign(SECRET, String(now), body), ts: String(now) }), false, 401);
  await check("tampered timestamp fails", req({ body, sig: sign(SECRET, String(now), body), ts: String(now + 1) }), false, 401);
  await check("wrong secret fails", req({ body, secret: "some-other-secret" }), false, 401);
  await check("stale timestamp (-6 min) fails", req({ body, ts: String(now - 6 * 60_000) }), false, 401);
  await check("future timestamp (+6 min) fails", req({ body, ts: String(now + 6 * 60_000) }), false, 401);
  await check("timestamp -4 min still passes", req({ body, ts: String(now - 4 * 60_000) }), true);
  await check("missing signature fails", new Request("http://localhost/x", { method: "POST", body, headers: { "X-Timestamp": String(now) } }), false, 401);
  await check("missing timestamp fails", new Request("http://localhost/x", { method: "POST", body, headers: { "X-Signature": "a".repeat(64) } }), false, 401);
  await check("non-numeric timestamp fails", req({ body, ts: "yesterday" }), false, 401);
  await check("signature of wrong length fails (no throw)", req({ body, sig: "abcd" }), false, 401);
  await check("signature with non-hex chars fails", req({ body, sig: "z".repeat(64) }), false, 401);
  await check("empty signature fails", req({ body, sig: "" }), false, 401);
  await check("validly signed but non-JSON body -> 400", req({ body: "not json{" }), false, 400);

  delete process.env.BRIDGE_SECRET;
  await check("BRIDGE_SECRET unset -> 503", req({ body }), false, 503);
  process.env.BRIDGE_SECRET = "";
  await check("BRIDGE_SECRET empty -> 503", req({ body }), false, 503);

  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
}
main();
