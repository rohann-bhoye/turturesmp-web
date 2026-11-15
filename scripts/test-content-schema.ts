// Run with: npx tsx scripts/test-content-schema.ts
import assert from "node:assert/strict";
import { SECTIONS, cleanItem, cleanText, isHttpsUrl, isImageSrc, isSectionKey, moveInList, normalizeItem, sectionDef } from "../src/server/content-schema";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const form = (o: Record<string, string>) => (k: string) => o[k];
const team = sectionDef("team")!;
const gallery = sectionDef("gallery")!;
const vote = sectionDef("vote")!;
const faq = sectionDef("faq")!;

t("every section has a valid title/sub field, fields and pages", () => {
  assert.equal(SECTIONS.length, 7);
  for (const s of SECTIONS) {
    assert.ok(s.fields.some((f) => f.name === s.title), `${s.key} title`);
    if (s.sub) assert.ok(s.fields.some((f) => f.name === s.sub), `${s.key} sub`);
    assert.ok(s.pages.length > 0 && s.max > 0);
    assert.equal(isSectionKey(s.key), true);
  }
  assert.equal(isSectionKey("nope"), false);
  assert.equal(isSectionKey(undefined), false);
});

t("cleanText trims, caps, strips control characters and handles line breaks", () => {
  assert.equal(cleanText("  hi  ", 10), "hi");
  assert.equal(cleanText("abcdef", 3), "abc");
  assert.equal(cleanText("a\u0000b\u0007c", 10), "abc");
  assert.equal(cleanText("a\nb", 10), "a b");
  assert.equal(cleanText("a\r\nb\nc", 10, true), "a\nb\nc");
  assert.equal(cleanText(undefined, 5), "");
});

t("https links", () => {
  assert.equal(isHttpsUrl("https://minecraftservers.org/server/1"), true);
  for (const u of ["http://x.com", "javascript:alert(1)", "//x.com", "x.com", "", "https://"]) assert.equal(isHttpsUrl(u), false, u);
});

t("gallery image sources", () => {
  assert.equal(isImageSrc("https://i.imgur.com/a.png"), true);
  assert.equal(isImageSrc("/gallery/spawn.png"), true);
  for (const s of ["/gallery/../secret.png", "/gallery/a/b.png", "/other/a.png", "http://x/a.png", "data:image/png;base64,AAAA", "javascript:1"]) assert.equal(isImageSrc(s), false, s);
});

t("team item: valid, colour default and lowercase", () => {
  const ok = cleanItem(team, form({ name: " Rohann07 ", role: "Owner", color: "#FFAA00", bio: "Founder" }));
  assert.deepEqual(ok, { ok: true, item: { name: "Rohann07", role: "Owner", color: "#ffaa00", bio: "Founder" } });
  const def = cleanItem(team, form({ name: "A", role: "Mod" }));
  assert.equal(def.ok && def.item.color, "#55ffff");
});

t("team item: required fields and bad colour are refused", () => {
  assert.equal(cleanItem(team, form({ name: "", role: "Mod" })).ok, false);
  assert.equal(cleanItem(team, form({ name: "A", role: "  " })).ok, false);
  const bad = cleanItem(team, form({ name: "A", role: "Mod", color: "red" }));
  assert.equal(bad.ok, false);
});

t("vote item: link must be https, reward optional", () => {
  assert.equal(cleanItem(vote, form({ name: "S", url: "http://s.org" })).ok, false);
  assert.equal(cleanItem(vote, form({ name: "S", url: "javascript:alert(1)" })).ok, false);
  const ok = cleanItem(vote, form({ name: "S", url: "https://s.org/x" }));
  assert.deepEqual(ok, { ok: true, item: { name: "S", url: "https://s.org/x", reward: "" } });
});

t("gallery item: bad image source refused", () => {
  assert.equal(cleanItem(gallery, form({ src: "javascript:alert(1)", caption: "x" })).ok, false);
  assert.equal(cleanItem(gallery, form({ src: "/gallery/a.png", caption: "Spawn" })).ok, true);
});

t("only the section's own fields are kept and lengths are capped", () => {
  const r = cleanItem(faq, form({ q: "Q".repeat(500), a: "A", evil: "<script>" }));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.item.q.length, 140);
    assert.equal("evil" in r.item, false);
  }
});

t("normalizeItem drops broken database rows", () => {
  assert.equal(normalizeItem(faq, null), null);
  assert.equal(normalizeItem(faq, "text"), null);
  assert.equal(normalizeItem(faq, { q: "only a question" }), null);
  assert.deepEqual(normalizeItem(faq, { q: "Q", a: "A", junk: 1 }), { q: "Q", a: "A" });
  assert.deepEqual(normalizeItem(faq, { q: 5, a: true }), { q: "5", a: "true" });
});

t("moveInList", () => {
  assert.deepEqual(moveInList([1, 2, 3], 1, -1), [2, 1, 3]);
  assert.deepEqual(moveInList([1, 2, 3], 1, 1), [1, 3, 2]);
  const same = [1, 2, 3];
  assert.equal(moveInList(same, 0, -1), same);
  assert.equal(moveInList(same, 2, 1), same);
  assert.equal(moveInList(same, 9, 1), same);
  assert.equal(moveInList(same, -1, 1), same);
  assert.deepEqual(same, [1, 2, 3]);
});

console.log(`\n${n} test groups passed`);
