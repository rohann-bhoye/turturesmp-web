// Run with: npx tsx scripts/test-players-util.ts
import assert from "node:assert/strict";
import {
  escapeRegex, isValidName, isValidUuid, isValidIp, maskIp, showIp, validateReason, validateMessage, parseDuration,
  formatMinutes, isExpired, parsePage, canActOn, bridgeCommandFor, cleanLine, isObjectId, addMinutes, MAX_REASON,
} from "../src/server/players-util";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log("ok  -", name);
};

t("escapeRegex neutralises metacharacters", () => {
  assert.equal(escapeRegex("a.b*c"), "a\\.b\\*c");
  const re = new RegExp(escapeRegex("(x)+[y]?"), "i");
  assert.ok(re.test("A(X)+[Y]?B"));
  assert.ok(!new RegExp(escapeRegex(".*")).test("abc"));
  assert.doesNotThrow(() => new RegExp(escapeRegex("\\")));
});

t("isValidName", () => {
  for (const ok of ["Steve", "a", "Name_16_chars_xx", ".BedrockUser", ".Bedrock User", "x_1"]) assert.ok(isValidName(ok), ok);
  for (const bad of ["", "a".repeat(17), "bad name!", "../etc", "a;b", " lead", "<img>", 5 as unknown as string]) assert.ok(!isValidName(bad), String(bad));
});

t("isValidUuid / isObjectId", () => {
  assert.ok(isValidUuid("069a79f4-44e9-4726-a5be-fca90e38aaf5"));
  assert.ok(isValidUuid("069a79f444e94726a5befca90e38aaf5"));
  assert.ok(!isValidUuid("nope"));
  assert.ok(!isValidUuid("069a79f4-44e9-4726-a5be-fca90e38aaf5; drop"));
  assert.ok(isObjectId("507f1f77bcf86cd799439011"));
  assert.ok(!isObjectId("507f1f77bcf86cd79943901"));
});

t("isValidIp", () => {
  assert.ok(isValidIp("203.0.113.42"));
  assert.ok(isValidIp("2001:db8::1"));
  assert.ok(!isValidIp("256.1.1.1"));
  assert.ok(!isValidIp("1.2.3"));
  assert.ok(!isValidIp("hello"));
});

t("maskIp / showIp", () => {
  assert.equal(maskIp("203.0.113.42"), "203.0.*.*");
  assert.equal(maskIp("2001:db8:85a3::1"), "2001:db8:*:*");
  assert.equal(maskIp(undefined), "unknown");
  assert.equal(maskIp(""), "unknown");
  assert.equal(showIp("203.0.113.42", "mod"), "203.0.*.*");
  assert.equal(showIp("203.0.113.42", "viewer"), "203.0.*.*");
  assert.equal(showIp("203.0.113.42", "admin"), "203.0.113.42");
  assert.equal(showIp("203.0.113.42", "owner"), "203.0.113.42");
  assert.ok(!maskIp("203.0.113.42").includes("113"));
});

t("validateReason", () => {
  assert.deepEqual(validateReason("  Griefing   spawn "), { ok: true, value: "Griefing spawn" });
  assert.equal(validateReason("").ok, false);
  assert.equal(validateReason("  ab ").ok, false);
  assert.equal(validateReason(undefined).ok, false);
  assert.equal(validateReason("x".repeat(MAX_REASON + 1)).ok, false);
  assert.equal(validateReason("x".repeat(MAX_REASON)).ok, true);
  assert.equal(cleanLine("a\nb\u0000c§4d"), "a b c 4d");
});

t("validateMessage", () => {
  const r = validateMessage("line1\r\n\r\n\r\n\r\nline2\u0000", 1, 2000, "Message");
  assert.deepEqual(r, { ok: true, value: "line1\n\nline2" });
  assert.equal(validateMessage("   ", 1, 10, "Message").ok, false);
  assert.equal(validateMessage("x".repeat(2001), 1, 2000, "Message").ok, false);
  assert.equal(validateMessage("x".repeat(2000), 1, 2000, "Message").ok, true);
});

t("parseDuration", () => {
  assert.deepEqual(parseDuration("30", "minutes"), { ok: true, value: 30 });
  assert.deepEqual(parseDuration("2", "hours"), { ok: true, value: 120 });
  assert.deepEqual(parseDuration(" 7 ", "days"), { ok: true, value: 10080 });
  for (const [a, u] of [["0", "days"], ["-1", "days"], ["1.5", "hours"], ["abc", "days"], ["", "days"], ["5", "weeks"], ["5", undefined], ["99999", "days"], ["1e3", "days"]] as const) {
    assert.equal(parseDuration(a, u).ok, false, `${a} ${u}`);
  }
  assert.equal(parseDuration("3650", "days").ok, true);
  assert.equal(parseDuration("3651", "days").ok, false);
});

t("formatMinutes / addMinutes", () => {
  assert.equal(formatMinutes(0), "0m");
  assert.equal(formatMinutes(45), "45m");
  assert.equal(formatMinutes(135), "2h 15m");
  assert.equal(formatMinutes(120), "2h");
  assert.equal(formatMinutes(1500), "1d 1h");
  assert.equal(formatMinutes(1440), "1d");
  assert.equal(formatMinutes(undefined), "0m");
  assert.equal(addMinutes(new Date(0), 2).getTime(), 120000);
});

t("isExpired", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(isExpired(null, now), false);
  assert.equal(isExpired(undefined, now), false);
  assert.equal(isExpired(new Date("2025-12-31T23:59:59Z"), now), true);
  assert.equal(isExpired(now, now), true);
  assert.equal(isExpired("2026-01-02T00:00:00Z", now), false);
});

t("parsePage", () => {
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage("0"), 1);
  assert.equal(parsePage("-4"), 1);
  assert.equal(parsePage("abc"), 1);
  assert.equal(parsePage("2.5"), 1);
  assert.equal(parsePage("50", 4), 4);
  assert.equal(parsePage(["2", "9"]), 2);
});

t("canActOn blocks staff at or above the actor", () => {
  assert.equal(canActOn("mod", undefined), true);
  assert.equal(canActOn("mod", "user"), true);
  assert.equal(canActOn("mod", "viewer"), true);
  assert.equal(canActOn("mod", "mod"), false);
  assert.equal(canActOn("mod", "admin"), false);
  assert.equal(canActOn("mod", "owner"), false);
  assert.equal(canActOn("admin", "mod"), true);
  assert.equal(canActOn("admin", "admin"), false);
  assert.equal(canActOn("owner", "admin"), true);
  assert.equal(canActOn("owner", "owner"), false);
});

t("bridgeCommandFor follows the spec mapping", () => {
  const exp = new Date("2026-02-01T00:00:00Z");
  const b = { uuid: "u", name: "Steve", reason: "r" };
  assert.deepEqual(bridgeCommandFor("ban", b), { type: "ban", payload: b });
  assert.deepEqual(bridgeCommandFor("tempban", { ...b, expiresAt: exp }), { type: "ban", payload: { ...b, expiresAt: exp.toISOString() } });
  assert.deepEqual(bridgeCommandFor("ipban", { ...b, ip: "1.2.3.4" }), { type: "ban", payload: { ...b, ip: "1.2.3.4" } });
  assert.deepEqual(bridgeCommandFor("mute", b), { type: "mute", payload: b });
  assert.deepEqual(bridgeCommandFor("tempmute", { ...b, expiresAt: exp }), { type: "mute", payload: { ...b, expiresAt: exp.toISOString() } });
  assert.equal(bridgeCommandFor("kick", b)?.type, "kick");
  assert.equal(bridgeCommandFor("warn", b)?.type, "warn");
  assert.equal(bridgeCommandFor("tempban", b), null);
  assert.equal(bridgeCommandFor("ipban", b), null);
  assert.equal(bridgeCommandFor("nuke", b), null);
});

console.log(`\n${n} test groups passed`);
