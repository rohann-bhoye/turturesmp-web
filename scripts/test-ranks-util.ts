// Run with: npx tsx scripts/test-ranks-util.ts
import assert from "node:assert/strict";
import {
  isValidKey, isValidColor, parsePermissions, mcToSpans, stripMcCodes, findInheritCycle, parseDays, escapeRegex,
} from "../src/server/ranks-util";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

t("keys", () => {
  for (const k of ["default", "vip_2", "a", "x".repeat(32)]) assert.equal(isValidKey(k), true, k);
  for (const k of ["", "Gold", "a b", "a-b", "x".repeat(33), "é", "a.b", undefined, 5]) assert.equal(isValidKey(k), false, String(k));
});

t("colours", () => {
  assert.equal(isValidColor("#ffAA00"), true);
  for (const c of ["ffaa00", "#fff", "#gggggg", "#ffaa000", ""]) assert.equal(isValidColor(c), false, c);
});

t("permissions: valid, dedupe, blank lines, CRLF", () => {
  const r = parsePermissions("essentials.home\r\n\n-essentials.fly\nworldedit.*\nessentials.home\n  group.vip:x  ");
  assert.deepEqual(r.nodes, ["essentials.home", "-essentials.fly", "worldedit.*", "group.vip:x"]);
  assert.deepEqual(r.errors, []);
});

t("permissions: invalid nodes reported with line numbers", () => {
  const r = parsePermissions("ok.node\nBad.Node\n-\nhas space\n--double");
  assert.deepEqual(r.nodes, ["ok.node"]);
  assert.equal(r.errors.length, 4);
  assert.match(r.errors[0], /^Line 2:/);
  assert.match(r.errors[1], /^Line 3:/);
});

t("permissions: limit", () => {
  const many = Array.from({ length: 6 }, (_, i) => `a.b${i}`).join("\n");
  assert.equal(parsePermissions(many, 5).errors.length, 1);
  assert.equal(parsePermissions("").nodes.length, 0);
});

t("colour codes: basic and reset", () => {
  assert.deepEqual(mcToSpans("&6[&eGold&6] &fVIP"), [
    { text: "[", color: "#ffaa00" },
    { text: "Gold", color: "#ffff55" },
    { text: "] ", color: "#ffaa00" },
    { text: "VIP", color: "#ffffff" },
  ]);
  assert.deepEqual(mcToSpans("&cred&rplain"), [{ text: "red", color: "#ff5555" }, { text: "plain" }]);
});

t("colour codes: formatting, colour resets formatting, case-insensitive", () => {
  assert.deepEqual(mcToSpans("&a&lBold&bNot"), [
    { text: "Bold", color: "#55ff55", bold: true },
    { text: "Not", color: "#55ffff" },
  ]);
  assert.deepEqual(mcToSpans("&A&Nx"), [{ text: "x", color: "#55ff55", underline: true }]);
  assert.deepEqual(mcToSpans("&ox&my"), [{ text: "x", italic: true }, { text: "y", italic: true, strike: true }]);
});

t("colour codes: hex, unknown codes, trailing &, obfuscate", () => {
  assert.deepEqual(mcToSpans("&#FF8800hi"), [{ text: "hi", color: "#ff8800" }]);
  assert.equal(stripMcCodes("a&zb&"), "a&zb&");
  assert.equal(stripMcCodes("&k&6x"), "x");
  assert.deepEqual(mcToSpans(""), []);
  assert.equal(stripMcCodes("&6[&eGold&6] "), "[Gold] ");
});

t("inheritance cycles", () => {
  const g = { default: [], iron: ["default"], gold: ["iron"] };
  assert.equal(findInheritCycle("diamond", ["gold"], g), null);
  assert.equal(findInheritCycle("default", [], g), null);
  assert.deepEqual(findInheritCycle("default", ["gold"], g), ["default", "gold", "iron", "default"]);
  assert.deepEqual(findInheritCycle("x", ["x"], g), ["x", "x"]);
  // two parents sharing a grandparent is not a cycle
  assert.equal(findInheritCycle("top", ["l", "r"], { l: ["base"], r: ["base"], base: [] }), null);
  // unknown parents are ignored
  assert.equal(findInheritCycle("a", ["ghost"], {}), null);
  // editing replaces the existing edges for that key
  assert.equal(findInheritCycle("iron", [], { iron: ["gold"], gold: ["iron"] }), null);
});

t("parseDays", () => {
  assert.equal(parseDays("30"), 30);
  for (const v of ["", "0", "-1", "1.5", "abc", "3651", undefined]) assert.equal(parseDays(v), null, String(v));
});

t("escapeRegex", () => {
  assert.equal(new RegExp(escapeRegex("a.b*(c)")).test("a.b*(c)"), true);
  assert.equal(new RegExp(`^${escapeRegex("a.b")}$`).test("axb"), false);
});

console.log(`\n${n} test groups passed`);
