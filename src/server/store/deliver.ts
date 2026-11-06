import { connectDB } from "@/server/db";
import { queueCommand } from "@/server/bridge-queue";
import { Entitlement, Order, Product } from "@/server/models/Store";
import { Player } from "@/server/models/Player";
import { Rank } from "@/server/models/Rank";
import { renderCommand } from "./commands";
import { computeExpiry, effectiveExpiry } from "./pricing";

// Order delivery. The only code that turns a paid order into rank/tag/command grants.
// Everything that touches the Minecraft server goes through queueCommand (docs/BRIDGE_API.md).

type Result = { ok: boolean; message?: string };
type LogEntry = { at: Date; step: string; ok: boolean; message?: string };

const OBJECT_ID = /^[a-f0-9]{24}$/i;
// A delivery that started more than this long ago and never finished is treated as crashed and may be retried.
const CLAIM_TTL_MS = 5 * 60 * 1000;
const notExpired = (now: Date) => ({ $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] });
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const entry = (step: string, ok: boolean, message?: string): LogEntry => ({ at: new Date(), step, ok, message });

/**
 * Delivers a paid order. Idempotent: only an order whose status is `paid` is processed, and the
 * order is claimed atomically first, so two callers (webhook + browser return) cannot both deliver.
 * Anything wrong with the data is found BEFORE the first command is queued; on failure the order
 * becomes `failed` with the reason in deliveryLog, and an admin can fix it and re-deliver.
 */
export async function deliverOrder(orderId: string): Promise<Result> {
  if (!OBJECT_ID.test(String(orderId))) return { ok: false, message: "Invalid order id." };
  await connectDB();
  const now = new Date();

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: "paid",
      $or: [{ deliveredAt: { $exists: false } }, { deliveredAt: null }, { deliveredAt: { $lt: new Date(now.getTime() - CLAIM_TTL_MS) } }],
    },
    { $set: { deliveredAt: now } }, // claim marker; replaced by the real time (or removed on failure) below
    { new: true }
  );
  if (!order) {
    const cur = await Order.findById(orderId).select("status").lean();
    if (!cur) return { ok: false, message: "Order not found." };
    if (cur.status === "delivered") return { ok: true, message: "Already delivered." };
    if (cur.status === "paid") return { ok: false, message: "Delivery is already in progress." };
    return { ok: false, message: `Order is ${cur.status}; only paid orders are delivered.` };
  }

  const logs: LogEntry[] = [];
  try {
    const summary = await run(order, logs, now);
    logs.push(entry("delivered", true, summary));
    await Order.updateOne({ _id: order._id }, { $set: { status: "delivered", deliveredAt: new Date() }, $push: { deliveryLog: { $each: logs } } });
    return { ok: true, message: summary };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logs.push(entry("failed", false, message));
    await Order.updateOne({ _id: order._id }, { $set: { status: "failed" }, $unset: { deliveredAt: 1 }, $push: { deliveryLog: { $each: logs } } });
    return { ok: false, message };
  }
}

type OrderDoc = NonNullable<Awaited<ReturnType<typeof Order.findOne>>>;

async function run(order: OrderDoc, logs: LogEntry[], now: Date): Promise<string> {
  const orderId = String(order._id);

  // ----- phase 1: check everything, change nothing -----
  let uuid = order.mcUuid || "";
  let name = order.mcName;
  if (!uuid) {
    const p = await Player.findOne({ name: new RegExp(`^${escapeRe(order.mcName)}$`, "i") }).lean();
    if (!p) throw new Error(`No UUID known for "${order.mcName}". The player must join the server once so the bridge can sync them, then re-deliver.`);
    uuid = p.uuid;
    name = p.name;
  }
  if (!order.items.length) throw new Error("Order has no items.");

  const plan = [];
  for (const item of order.items) {
    const product = item.productId ? await Product.findById(item.productId) : await Product.findOne({ slug: item.slug });
    if (!product) throw new Error(`Product "${item.name || item.slug}" no longer exists.`);
    const qty = Math.min(100, Math.max(1, Math.floor(item.qty || 1)));
    const g = product.grants;
    if (g?.rankKey && !(await Rank.exists({ key: g.rankKey }))) throw new Error(`Rank "${g.rankKey}" (product ${product.slug}) does not exist in Ranks & Tags.`);
    const commands: string[] = [];
    for (const tpl of g?.commands ?? []) {
      const r = renderCommand(tpl, { player: name, uuid });
      if (!r.ok) throw new Error(`Product ${product.slug}: ${r.error}`);
      for (let i = 0; i < qty; i++) commands.push(r.command);
    }
    plan.push({ product, qty, commands });
  }

  // ----- phase 2: apply -----
  let granted = 0;
  let queued = 0;
  const by = { createdBy: "store", orderId };
  for (const { product, qty, commands } of plan) {
    const g = product.grants;

    // One entitlement per order item. A repeat delivery of the same order reuses it (no double extension).
    let ent = await Entitlement.findOne({ orderId: order._id, productSlug: product.slug });
    if (!ent) {
      const owned = await Entitlement.find({ playerUuid: uuid, productSlug: product.slug, active: true, ...notExpired(now) }).lean();
      // Already owned and still running: the new time is added after the current expiry (renewal).
      const chainFrom = owned.length && owned.every((o) => o.expiresAt) ? effectiveExpiry(owned) : null;
      const win = computeExpiry({ now, durationDays: product.durationDays, qty, chainFrom });
      ent = await Entitlement.create({
        playerUuid: uuid,
        playerName: name,
        orderId: order._id,
        productSlug: product.slug,
        type: product.type,
        startsAt: win.startsAt,
        expiresAt: win.expiresAt ?? undefined,
        active: true,
      });
      logs.push(entry(`entitlement ${product.slug}`, true, win.expiresAt ? `until ${win.expiresAt.toISOString()}` : "permanent"));
    } else if (!ent.active) {
      throw new Error(`Entitlement for ${product.slug} was revoked; create a new order instead of re-delivering.`);
    } else {
      logs.push(entry(`entitlement ${product.slug}`, true, "already exists for this order, reused"));
    }
    granted++;

    // What the server should show: permanent if any active copy is permanent, otherwise the latest expiry.
    const active = await Entitlement.find({ playerUuid: uuid, productSlug: product.slug, active: true, ...notExpired(now) }).lean();
    const expiry = effectiveExpiry(active);

    if (g?.rankKey) {
      await queueCommand("rank_set", { uuid, name, rankKey: g.rankKey, ...(expiry ? { expiresAt: expiry.toISOString() } : {}) }, by);
      queued++;
      logs.push(entry(`rank_set ${g.rankKey}`, true, expiry ? `expires ${expiry.toISOString()}` : "permanent"));
      await optimisticRank(uuid, g.rankKey);
    }
    if (g?.tagKey) {
      await queueCommand("tag_set", { uuid, name, tagKey: g.tagKey }, by);
      queued++;
      logs.push(entry(`tag_set ${g.tagKey}`, true));
      await Player.updateOne({ uuid }, { $set: { tagKey: g.tagKey } });
    }
    for (const command of commands) {
      await queueCommand("run_command", { command }, by);
      queued++;
      logs.push(entry("run_command", true, command));
    }
    if (g?.discordRoleId) logs.push(entry("discord_role pending", true, `role ${g.discordRoleId} will be granted once the Discord bot is connected`));
  }
  return `Delivered ${granted} item(s) to ${name}; ${queued} command(s) queued.`;
}

// Mirror the new rank on the Player record straight away (the bridge sync confirms it later).
// A lower-weight purchase never overwrites a higher rank the player already has.
async function optimisticRank(uuid: string, rankKey: string) {
  const [player, next] = await Promise.all([Player.findOne({ uuid }).select("rankKey").lean(), Rank.findOne({ key: rankKey }).select("weight").lean()]);
  if (!player) return;
  const cur = await Rank.findOne({ key: player.rankKey }).select("weight").lean();
  if (!cur || (next?.weight ?? 0) >= (cur.weight ?? 0)) await Player.updateOne({ uuid }, { $set: { rankKey } });
}

// ---------------------------------------------------------------------------------------------

/**
 * Revokes one entitlement: marks it inactive and queues rank_remove / tag_set null on the server.
 * If the player still holds another active entitlement that grants the same rank or tag, nothing is
 * removed; the rank is re-asserted with the remaining expiry instead.
 */
export async function revokeEntitlement(entitlementId: string, opts: { createdBy?: string } = {}): Promise<Result> {
  if (!OBJECT_ID.test(String(entitlementId))) return { ok: false, message: "Invalid entitlement id." };
  await connectDB();
  const now = new Date();
  const ent = await Entitlement.findOneAndUpdate({ _id: entitlementId, active: true }, { $set: { active: false, revokedAt: now } }, { new: true });
  if (!ent) return { ok: false, message: "Entitlement not found or already inactive." };

  const by = { createdBy: opts.createdBy ?? "system", orderId: ent.orderId ? String(ent.orderId) : undefined };
  const uuid = ent.playerUuid;
  const name = ent.playerName || (await Player.findOne({ uuid }).select("name").lean())?.name || uuid;
  const product = await Product.findOne({ slug: ent.productSlug }).lean();
  const done: string[] = [];

  // Other active entitlements (any product) that grant the same rank / tag.
  const stillOwned = async (field: "rankKey" | "tagKey", key: string) => {
    const slugs = (await Product.find({ [`grants.${field}`]: key }).select("slug").lean()).map((p) => p.slug);
    return Entitlement.find({ playerUuid: uuid, active: true, _id: { $ne: ent._id }, productSlug: { $in: slugs }, ...notExpired(now) }).lean();
  };

  const rankKey = product?.grants?.rankKey;
  if (rankKey) {
    const others = await stillOwned("rankKey", rankKey);
    if (others.length) {
      const exp = effectiveExpiry(others);
      await queueCommand("rank_set", { uuid, name, rankKey, ...(exp ? { expiresAt: exp.toISOString() } : {}) }, by);
      done.push(`rank ${rankKey} kept (another purchase is still active)`);
    } else {
      await queueCommand("rank_remove", { uuid, name, rankKey }, by);
      await Player.updateOne({ uuid, rankKey }, { $set: { rankKey: "default" } });
      done.push(`rank ${rankKey} removed`);
    }
  }
  const tagKey = product?.grants?.tagKey;
  if (tagKey) {
    const others = await stillOwned("tagKey", tagKey);
    if (!others.length) {
      await queueCommand("tag_set", { uuid, name, tagKey: null }, by);
      await Player.updateOne({ uuid, tagKey }, { $unset: { tagKey: 1 } });
      done.push(`tag ${tagKey} cleared`);
    }
  }
  return { ok: true, message: `Revoked ${ent.productSlug} for ${name}${done.length ? ": " + done.join(", ") : " (nothing to remove on the server)"}.` };
}

/** Revokes every still-active entitlement created by an order (used by refunds). */
export async function revokeOrderEntitlements(orderId: string, opts: { createdBy?: string } = {}): Promise<{ revoked: number; messages: string[] }> {
  await connectDB();
  const list = await Entitlement.find({ orderId, active: true }).select("_id").lean();
  const messages: string[] = [];
  let revoked = 0;
  for (const e of list) {
    const r = await revokeEntitlement(String(e._id), opts);
    if (r.ok) revoked++;
    if (r.message) messages.push(r.message);
  }
  return { revoked, messages };
}

/**
 * Finds active entitlements whose expiresAt has passed and revokes them. Meant to be called by a
 * cron route (e.g. every 10 minutes). Handles at most `limit` per call; the rest is picked up next run.
 */
export async function expireEntitlements(limit = 500): Promise<{ checked: number; revoked: number; failed: number }> {
  await connectDB();
  const due = await Entitlement.find({ active: true, expiresAt: { $lt: new Date() } }).sort({ expiresAt: 1 }).limit(limit).select("_id").lean();
  let revoked = 0;
  let failed = 0;
  for (const e of due) {
    try {
      const r = await revokeEntitlement(String(e._id), { createdBy: "system" });
      if (r.ok) revoked++;
    } catch (err) {
      failed++;
      console.error("expireEntitlements: could not revoke", String(e._id), err);
    }
  }
  return { checked: due.length, revoked, failed };
}
