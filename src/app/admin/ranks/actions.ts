"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/server/db";
import { Rank, Tag } from "@/server/models/Rank";
import { Player } from "@/server/models/Player";
import { Product } from "@/server/models/Store";
import { requireRole } from "@/server/guard";
import { audit } from "@/server/audit";
import { queueCommand } from "@/server/bridge-queue";
import {
  isValidKey, isValidColor, parsePermissions, findInheritCycle, parseDays, DISCORD_ID_RE,
} from "@/server/ranks-util";

const text = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
// Prefix/suffix keep their trailing space ("&6[Gold] "), so only trim the start.
const rawText = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").replace(/^\s+/, "").slice(0, max);
const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

type Tab = "ranks" | "tags" | "assign";
const to = (tab: Tab, params: Record<string, string>) => `/admin/ranks?${new URLSearchParams({ tab, ...params }).toString()}`;
const done = (tab: Tab, extra: Record<string, string> = {}): never => {
  revalidatePath("/admin/ranks");
  return redirect(to(tab, { saved: "1", ...extra }));
};

// ---------------------------------------------------------------- ranks
export async function saveRank(formData: FormData) {
  const user = await requireRole("admin");
  const originalKey = text(formData, "originalKey", 32);
  const editing = originalKey !== "";
  const key = editing ? originalKey : text(formData, "key", 32).toLowerCase();
  const fail = (msg: string) =>
    redirect(to("ranks", { error: msg, ...(editing ? { edit: originalKey } : {}) }));

  if (!isValidKey(key)) return fail("Key must be 1 to 32 characters: lowercase letters, digits and underscore.");
  const displayName = text(formData, "displayName", 32);
  const color = text(formData, "color", 7);
  const prefix = rawText(formData, "prefix", 64);
  const suffix = rawText(formData, "suffix", 64);
  const weight = Number(String(formData.get("weight") ?? "").trim());
  const isStaff = formData.get("isStaff") === "on";
  const isDefault = formData.get("isDefault") === "on";
  const discordRoleId = text(formData, "discordRoleId", 20);
  const inheritsRaw = formData.getAll("inherits").map(String);

  if (!displayName) return fail("Display name is required.");
  if (!isValidColor(color)) return fail("Colour must look like #ffaa00.");
  if (!Number.isInteger(weight) || weight < -1000 || weight > 100000) return fail("Weight must be a whole number from -1000 to 100000.");
  if (discordRoleId && !DISCORD_ID_RE.test(discordRoleId)) return fail("Discord role id must be 17 to 20 digits.");
  const perms = parsePermissions(String(formData.get("permissions") ?? ""));
  if (perms.errors.length) return fail(perms.errors.slice(0, 3).join("; "));

  await connectDB();
  const existing = await Rank.findOne({ key }).lean();
  if (editing && !existing) return fail("That rank no longer exists.");
  if (!editing && existing) return fail(`A rank with key "${key}" already exists.`);
  if (existing?.isDefault && !isDefault) return fail("This is the default rank. Mark a different rank as default instead.");

  // Parents must exist and must not form a cycle.
  const inherits = [...new Set(inheritsRaw)].filter((k) => k !== "");
  if (inherits.some((k) => !isValidKey(k))) return fail("Invalid parent rank.");
  const all = await Rank.find({}, { key: 1, inherits: 1 }).lean();
  const known = new Set(all.map((r) => r.key));
  const missing = inherits.find((k) => !known.has(k));
  if (missing) return fail(`Parent rank "${missing}" does not exist.`);
  const graph: Record<string, string[]> = {};
  for (const r of all) graph[r.key] = r.inherits ?? [];
  const cycle = findInheritCycle(key, inherits, graph);
  if (cycle) return fail(`Inheritance cycle: ${cycle.join(" → ")}`);

  const set = {
    displayName, color, prefix, suffix, weight, inherits, permissions: perms.nodes,
    isStaff, isDefault, syncedAt: null,
    ...(discordRoleId ? { discordRoleId } : {}),
  };
  if (isDefault) await Rank.updateMany({ isDefault: true, key: { $ne: key } }, { $set: { isDefault: false } });
  await Rank.findOneAndUpdate({ key }, { $set: set, ...(discordRoleId ? {} : { $unset: { discordRoleId: 1 } }) }, { upsert: true });

  await queueCommand(
    "rank_define",
    { key, displayName, prefix, suffix, weight, inherits, permissions: perms.nodes },
    { createdBy: user.username }
  );
  await audit(user, editing ? "rank.update" : "rank.create", key, {
    displayName, weight, inherits, isStaff, isDefault, permissionCount: perms.nodes.length,
  });
  return done("ranks");
}

export async function deleteRank(formData: FormData) {
  const user = await requireRole("admin");
  const key = text(formData, "key", 32);
  const fail = (msg: string) => redirect(to("ranks", { error: msg }));
  if (!isValidKey(key)) return fail("Invalid rank key.");

  await connectDB();
  const rank = await Rank.findOne({ key }).lean();
  if (!rank) return fail("Rank not found.");
  if (rank.isDefault) return fail("The default rank cannot be deleted. Make another rank the default first.");
  const [players, products, children] = await Promise.all([
    Player.countDocuments({ rankKey: key }),
    Product.countDocuments({ "grants.rankKey": key }),
    Rank.find({ inherits: key }, { key: 1 }).lean(),
  ]);
  if (players) return fail(`${players} player(s) still have this rank. Move them first.`);
  if (products) return fail(`${products} store product(s) grant this rank. Change or remove them first.`);
  if (children.length) return fail(`Ranks inheriting from it: ${children.map((c) => c.key).join(", ")}. Remove the inheritance first.`);

  await Rank.deleteOne({ key });
  await queueCommand("run_command", { command: `lp deletegroup ${key}` }, { createdBy: user.username });
  await audit(user, "rank.delete", key, { displayName: rank.displayName });
  return done("ranks");
}

const SEED = [
  { key: "default", displayName: "Default", color: "#aaaaaa", prefix: "&7", weight: 0, inherits: [], isStaff: false, isDefault: true },
  { key: "iron", displayName: "Iron", color: "#d8d8d8", prefix: "&f[Iron] ", weight: 10, inherits: ["default"], isStaff: false, isDefault: false },
  { key: "gold", displayName: "Gold", color: "#ffaa00", prefix: "&6[Gold] ", weight: 20, inherits: ["iron"], isStaff: false, isDefault: false },
  { key: "diamond", displayName: "Diamond", color: "#55ffff", prefix: "&b[Diamond] ", weight: 30, inherits: ["gold"], isStaff: false, isDefault: false },
  { key: "helper", displayName: "Helper", color: "#55ff55", prefix: "&a[Helper] ", weight: 50, inherits: ["default"], isStaff: true, isDefault: false },
  { key: "mod", displayName: "Mod", color: "#5555ff", prefix: "&9[Mod] ", weight: 60, inherits: ["helper"], isStaff: true, isDefault: false },
  { key: "admin", displayName: "Admin", color: "#ff5555", prefix: "&c[Admin] ", weight: 80, inherits: ["mod"], isStaff: true, isDefault: false },
  { key: "owner", displayName: "Owner", color: "#ffaa00", prefix: "&4&l[Owner] ", weight: 100, inherits: ["admin"], isStaff: true, isDefault: false },
];

export async function seedRanks() {
  const user = await requireRole("admin");
  await connectDB();
  if ((await Rank.estimatedDocumentCount()) > 0) redirect(to("ranks", { error: "Ranks already exist. Seeding is only for an empty list." }));
  for (const r of SEED) {
    await Rank.create({ ...r, suffix: "", permissions: [], syncedAt: null });
    await queueCommand(
      "rank_define",
      { key: r.key, displayName: r.displayName, prefix: r.prefix, suffix: "", weight: r.weight, inherits: r.inherits, permissions: [] },
      { createdBy: user.username }
    );
  }
  await audit(user, "rank.seed", undefined, { keys: SEED.map((r) => r.key) });
  return done("ranks");
}

// ---------------------------------------------------------------- tags
export async function saveTag(formData: FormData) {
  const user = await requireRole("admin");
  const originalKey = text(formData, "originalKey", 32);
  const editing = originalKey !== "";
  const key = editing ? originalKey : text(formData, "key", 32).toLowerCase();
  const fail = (msg: string) => redirect(to("tags", { error: msg, ...(editing ? { edit: originalKey } : {}) }));

  if (!isValidKey(key)) return fail("Key must be 1 to 32 characters: lowercase letters, digits and underscore.");
  const display = text(formData, "display", 32);
  const color = text(formData, "color", 7);
  const description = text(formData, "description", 200);
  const active = formData.get("active") === "on";
  if (!display) return fail('Display text is required, for example "[Legend]".');
  if (!isValidColor(color)) return fail("Colour must look like #ffd54a.");

  await connectDB();
  const existing = await Tag.findOne({ key }).lean();
  if (editing && !existing) return fail("That tag no longer exists.");
  if (!editing && existing) return fail(`A tag with key "${key}" already exists.`);

  await Tag.findOneAndUpdate({ key }, { $set: { display, color, description, active } }, { upsert: true });
  await audit(user, editing ? "tag.update" : "tag.create", key, { display, color, active });
  return done("tags");
}

export async function deleteTag(formData: FormData) {
  const user = await requireRole("admin");
  const key = text(formData, "key", 32);
  const fail = (msg: string) => redirect(to("tags", { error: msg }));
  if (!isValidKey(key)) return fail("Invalid tag key.");

  await connectDB();
  const tag = await Tag.findOne({ key }).lean();
  if (!tag) return fail("Tag not found.");
  const [players, products] = await Promise.all([
    Player.countDocuments({ tagKey: key }),
    Product.countDocuments({ "grants.tagKey": key }),
  ]);
  if (players) return fail(`${players} player(s) are using this tag. Clear it from them first, or mark the tag inactive.`);
  if (products) return fail(`${products} store product(s) grant this tag. Change or remove them first.`);

  await Tag.deleteOne({ key });
  await audit(user, "tag.delete", key, { display: tag.display });
  return done("tags");
}

// ---------------------------------------------------------------- assign
async function loadPlayer(formData: FormData, q: string) {
  const uuid = text(formData, "uuid", 36);
  const fail = (msg: string) => redirect(to("assign", { error: msg, ...(q ? { q } : {}) }));
  if (!UUID_RE.test(uuid)) return fail("Invalid player.");
  await connectDB();
  const player = await Player.findOne({ uuid });
  if (!player) return fail("Player not found.");
  return { player, q, fail };
}

export async function assignRank(formData: FormData) {
  const user = await requireRole("admin");
  const q = text(formData, "q", 16);
  const { player, fail } = await loadPlayer(formData, q);
  const rankKey = text(formData, "rankKey", 32);
  if (!isValidKey(rankKey)) return fail("Choose a rank.");
  const rank = await Rank.findOne({ key: rankKey }).lean();
  if (!rank) return fail("That rank does not exist.");

  let expiresAt: Date | undefined;
  if (text(formData, "expiry", 8) === "days") {
    const days = parseDays(formData.get("days"));
    if (!days) return fail("Days must be a whole number from 1 to 3650.");
    expiresAt = new Date(Date.now() + days * 864e5);
  }

  const before = player.rankKey;
  await queueCommand(
    "rank_set",
    { uuid: player.uuid, name: player.name, rankKey, ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}) },
    { createdBy: user.username }
  );
  player.rankKey = rankKey; // optimistic; the plugin sync corrects it if the command fails
  await player.save();
  await audit(user, "rank.assign", player.name, { uuid: player.uuid, from: before, to: rankKey, expiresAt: expiresAt?.toISOString() ?? null });
  return done("assign", { q, uuid: player.uuid });
}

export async function removeRank(formData: FormData) {
  const user = await requireRole("admin");
  const q = text(formData, "q", 16);
  const { player, fail } = await loadPlayer(formData, q);
  const current = player.rankKey;
  const def = await Rank.findOne({ isDefault: true }).lean();
  const fallback = def?.key ?? "default";
  if (!current || current === fallback) return fail("This player only has the default rank.");

  await queueCommand("rank_remove", { uuid: player.uuid, name: player.name, rankKey: current }, { createdBy: user.username });
  player.rankKey = fallback;
  await player.save();
  await audit(user, "rank.remove", player.name, { uuid: player.uuid, removed: current, now: fallback });
  return done("assign", { q, uuid: player.uuid });
}

export async function setPlayerTag(formData: FormData) {
  const user = await requireRole("admin");
  const q = text(formData, "q", 16);
  const { player, fail } = await loadPlayer(formData, q);
  const tagKey = text(formData, "tagKey", 32); // empty = clear
  if (tagKey) {
    if (!isValidKey(tagKey)) return fail("Invalid tag.");
    const tag = await Tag.findOne({ key: tagKey }).lean();
    if (!tag) return fail("That tag does not exist.");
    if (!tag.active) return fail("That tag is inactive. Activate it first.");
  }
  const before = player.tagKey ?? null;
  await queueCommand("tag_set", { uuid: player.uuid, name: player.name, tagKey: tagKey || null }, { createdBy: user.username });
  player.tagKey = tagKey || undefined;
  await player.save();
  await audit(user, tagKey ? "tag.assign" : "tag.clear", player.name, { uuid: player.uuid, from: before, to: tagKey || null });
  return done("assign", { q, uuid: player.uuid });
}
