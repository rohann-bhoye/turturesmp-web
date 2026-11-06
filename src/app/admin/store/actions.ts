"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/server/db";
import { requireRole } from "@/server/guard";
import { audit } from "@/server/audit";
import { Coupon, Entitlement, Order, Product, PRODUCT_TYPES } from "@/server/models/Store";
import { Player } from "@/server/models/Player";
import { Rank, Tag } from "@/server/models/Rank";
import { deliverOrder, revokeOrderEntitlements } from "@/server/store/deliver";
import { createOrder } from "@/server/store/order-no";
import { validateCommandTemplate } from "@/server/store/commands";
import { isCurrency, normalizeCouponCode, parseMoney } from "@/server/store/pricing";
import { ranks as siteRanks } from "@/data";

// Every action: requireRole("admin") first, hand-written validation, audit(), then redirect with ?ok= / ?error=.

const OID = /^[a-f0-9]{24}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const NAME = /^[A-Za-z0-9_.]{1,32}$/;
const str = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
const lines = (f: FormData, k: string, max: number) =>
  String(f.get(k) ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Blank -> undefined, valid integer in range -> number, anything else -> null. */
function optInt(f: FormData, k: string, min: number, max: number): number | undefined | null {
  const raw = str(f, k, 12);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

const go = (tab: string, kind: "ok" | "error", msg: string, extra = ""): never =>
  redirect(`/admin/store?tab=${tab}&${kind}=${encodeURIComponent(msg)}${extra}`);
const goOrder = (id: string, kind: "ok" | "error", msg: string): never =>
  redirect(`/admin/store/orders/${id}?${kind}=${encodeURIComponent(msg)}`);
const refreshStore = () => revalidatePath("/admin/store", "layout");

// =============================== products ===============================

export async function saveProduct(f: FormData) {
  const user = await requireRole("admin");
  const id = str(f, "id", 24);
  const editing = OID.test(id);
  const fail = (m: string): never => redirect(`/admin/store?tab=products&edit=${editing ? id : "new"}&error=${encodeURIComponent(m)}`);

  const slug = str(f, "slug", 40).toLowerCase();
  const name = str(f, "name", 60);
  const type = str(f, "type", 10);
  const color = str(f, "color", 7);
  const priceInr = parseMoney(f.get("priceInr"));
  const priceUsd = parseMoney(f.get("priceUsd"));
  const durationDays = optInt(f, "durationDays", 1, 3650);
  const stock = optInt(f, "stock", 0, 1_000_000);
  const sortOrder = optInt(f, "sortOrder", -9999, 9999);
  const perks = lines(f, "perks", 20);
  const commands = lines(f, "commands", 20);
  const rankKey = str(f, "rankKey", 40).toLowerCase();
  const tagKey = str(f, "tagKey", 40).toLowerCase();
  const discordRoleId = str(f, "discordRoleId", 25);

  if (!SLUG.test(slug)) return fail("Slug must be 1-40 characters: lowercase letters, numbers and dashes.");
  if (!name) return fail("Name is required.");
  if (!(PRODUCT_TYPES as readonly string[]).includes(type)) return fail("Unknown product type.");
  if (!/^#[0-9a-f]{6}$/i.test(color)) return fail("Colour must look like #55e03a.");
  if (priceInr === null || priceUsd === null) return fail("Prices must be numbers like 399 or 9.99 (max 2 decimals).");
  if (durationDays === null) return fail("Duration must be a whole number of days (1-3650), or empty for permanent.");
  if (stock === null) return fail("Stock must be a whole number, or empty for unlimited.");
  if (sortOrder === null) return fail("Sort order must be a whole number.");
  if (perks.some((p) => p.length > 120)) return fail("Each perk can be at most 120 characters.");
  for (const c of commands) {
    const bad = validateCommandTemplate(c);
    if (bad) return fail(bad);
  }
  if (discordRoleId && !/^\d{15,25}$/.test(discordRoleId)) return fail("Discord role ID must be the numeric ID (15-25 digits).");

  await connectDB();
  if (rankKey && !(await Rank.exists({ key: rankKey }))) return fail(`Rank "${rankKey}" does not exist. Create it under Ranks & Tags first.`);
  if (tagKey && !(await Tag.exists({ key: tagKey }))) return fail(`Tag "${tagKey}" does not exist. Create it under Ranks & Tags first.`);

  const doc = {
    name,
    type,
    description: str(f, "description", 500),
    perks,
    color,
    price: { inr: priceInr, usd: priceUsd },
    featured: f.get("featured") === "on",
    active: f.get("active") === "on",
    sortOrder: sortOrder ?? 0,
    grants: {
      ...(rankKey ? { rankKey } : {}),
      ...(tagKey ? { tagKey } : {}),
      ...(discordRoleId ? { discordRoleId } : {}),
      commands,
    },
  };
  const unset: Record<string, 1> = {};
  if (durationDays === undefined) unset.durationDays = 1;
  if (stock === undefined) unset.stock = 1;
  const optional = { ...(durationDays !== undefined ? { durationDays } : {}), ...(stock !== undefined ? { stock } : {}) };

  if (editing) {
    // The slug is the key orders and entitlements refer to, so it is not changed after creation.
    const res = await Product.findByIdAndUpdate(id, { $set: { ...doc, ...optional }, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
    if (!res) return fail("Product not found.");
    await audit(user, "store.product.update", res.slug, { name, type, priceInr, priceUsd, active: doc.active });
  } else {
    try {
      await Product.create({ ...doc, ...optional, slug });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) return fail(`A product with slug "${slug}" already exists.`);
      throw e;
    }
    await audit(user, "store.product.create", slug, { name, type, priceInr, priceUsd });
  }
  refreshStore();
  return go("products", "ok", `Product "${name}" saved.`);
}

/** Deletes a product, or archives it (inactive, not featured) when orders or entitlements refer to it. */
export async function deleteProduct(f: FormData) {
  const user = await requireRole("admin");
  const id = str(f, "id", 24);
  if (!OID.test(id)) return go("products", "error", "Invalid request.");
  await connectDB();
  const p = await Product.findById(id);
  if (!p) return go("products", "error", "Product not found.");
  const used = (await Order.exists({ "items.slug": p.slug })) || (await Entitlement.exists({ productSlug: p.slug }));
  if (used) {
    await Product.updateOne({ _id: p._id }, { $set: { active: false, featured: false } });
    await audit(user, "store.product.archive", p.slug);
    refreshStore();
    return go("products", "ok", `"${p.name}" has orders, so it was archived (hidden from the store) instead of deleted.`);
  }
  await Product.deleteOne({ _id: p._id });
  await audit(user, "store.product.delete", p.slug);
  refreshStore();
  return go("products", "ok", `"${p.name}" deleted.`);
}

/** Creates one product per rank card in src/data.ts. Existing slugs are left untouched. */
export async function seedProducts() {
  const user = await requireRole("admin");
  await connectDB();
  let created = 0;
  let unlinked = 0;
  for (const [i, r] of siteRanks.entries()) {
    const slug = r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const inr = parseMoney(r.price.inr);
    const usd = parseMoney(r.price.usd);
    if (inr === null || usd === null) continue;
    const hasRank = !!(await Rank.exists({ key: slug }));
    if (!hasRank) unlinked++;
    const res = await Product.updateOne(
      { slug },
      {
        $setOnInsert: {
          slug,
          name: `${r.name} Rank`,
          type: "rank",
          description: "",
          perks: r.perks,
          color: r.color,
          price: { inr, usd },
          featured: !!("featured" in r && r.featured),
          active: true,
          sortOrder: i,
          grants: { ...(hasRank ? { rankKey: slug } : {}), commands: [] },
        },
      },
      { upsert: true }
    );
    if (res.upsertedCount) created++;
  }
  await audit(user, "store.product.seed", "data.ts", { created });
  refreshStore();
  const note = unlinked ? ` ${unlinked} have no matching rank key yet: open them and pick the rank to grant.` : "";
  return go("products", "ok", created ? `Created ${created} product(s) from the website rank cards.${note}` : "Nothing to create: those products already exist.");
}

// =============================== coupons ===============================

export async function saveCoupon(f: FormData) {
  const user = await requireRole("admin");
  const id = str(f, "id", 24);
  const editing = OID.test(id);
  const fail = (m: string): never => redirect(`/admin/store?tab=coupons&edit=${editing ? id : "new"}&error=${encodeURIComponent(m)}`);

  const code = normalizeCouponCode(str(f, "code", 32));
  const pctRaw = str(f, "percentOff", 6);
  const percentOff = pctRaw ? Number(pctRaw) : undefined;
  const amountInrRaw = str(f, "amountInr", 12);
  const amountUsdRaw = str(f, "amountUsd", 12);
  const amountInr = amountInrRaw ? parseMoney(amountInrRaw) : undefined;
  const amountUsd = amountUsdRaw ? parseMoney(amountUsdRaw) : undefined;
  const maxUses = optInt(f, "maxUses", 1, 10_000_000);
  const expRaw = str(f, "expiresAt", 10);
  const slugs = [...new Set(f.getAll("productSlugs").map((s) => String(s).toLowerCase()).filter((s) => SLUG.test(s)))].slice(0, 100);

  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return fail("Code must be 3-32 characters: letters, numbers, dash or underscore.");
  if (percentOff !== undefined && !(Number.isFinite(percentOff) && percentOff > 0 && percentOff <= 100 && Math.round(percentOff * 100) === percentOff * 100)) return fail("Percent off must be above 0 and at most 100 (max 2 decimals).");
  if (amountInr === null || amountUsd === null) return fail("Fixed amounts must be numbers like 50 or 1.5.");
  if (percentOff === undefined && !amountInr && !amountUsd) return fail("Give the coupon a percentage and/or a fixed amount for at least one currency.");
  if (maxUses === null) return fail("Max uses must be a whole number, or empty for unlimited.");
  let expiresAt: Date | undefined;
  if (expRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expRaw) || Number.isNaN(Date.parse(expRaw))) return fail("Expiry must be a valid date.");
    expiresAt = new Date(`${expRaw}T23:59:59.999Z`);
  }

  await connectDB();
  if (slugs.length && (await Product.countDocuments({ slug: { $in: slugs } })) !== slugs.length) return fail("One of the selected products no longer exists.");

  const set = {
    productSlugs: slugs,
    active: f.get("active") === "on",
    ...(percentOff !== undefined ? { percentOff } : {}),
    amountOff: { ...(amountInr ? { inr: amountInr } : {}), ...(amountUsd ? { usd: amountUsd } : {}) },
    ...(maxUses !== undefined ? { maxUses } : {}),
    ...(expiresAt ? { expiresAt } : {}),
  };
  const unset: Record<string, 1> = {};
  if (percentOff === undefined) unset.percentOff = 1;
  if (maxUses === undefined) unset.maxUses = 1;
  if (!expiresAt) unset.expiresAt = 1;

  if (editing) {
    const res = await Coupon.findByIdAndUpdate(id, { $set: { code, ...set }, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
    if (!res) return fail("Coupon not found.");
  } else {
    try {
      await Coupon.create({ code, ...set });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) return fail(`Coupon ${code} already exists.`);
      throw e;
    }
  }
  await audit(user, editing ? "store.coupon.update" : "store.coupon.create", code, { percentOff, amountInr, amountUsd, maxUses, expiresAt: expiresAt?.toISOString(), products: slugs });
  refreshStore();
  return go("coupons", "ok", `Coupon ${code} saved.`);
}

export async function deleteCoupon(f: FormData) {
  const user = await requireRole("admin");
  const id = str(f, "id", 24);
  if (!OID.test(id)) return go("coupons", "error", "Invalid request.");
  await connectDB();
  const c = await Coupon.findById(id);
  if (!c) return go("coupons", "error", "Coupon not found.");
  if ((c.used ?? 0) > 0) {
    await Coupon.updateOne({ _id: c._id }, { $set: { active: false } });
    await audit(user, "store.coupon.deactivate", c.code, { used: c.used });
    refreshStore();
    return go("coupons", "ok", `${c.code} was used ${c.used} time(s), so it was deactivated instead of deleted.`);
  }
  await Coupon.deleteOne({ _id: c._id });
  await audit(user, "store.coupon.delete", c.code);
  refreshStore();
  return go("coupons", "ok", `Coupon ${c.code} deleted.`);
}

// =============================== orders ===============================

/** A sale handled outside the website (UPI, cash...). Optionally marks it paid and delivers it right away. */
export async function createManualOrder(f: FormData) {
  const user = await requireRole("admin");
  const fail = (m: string): never => go("orders", "error", m, "&new=1");

  const mcName = str(f, "mcName", 32);
  const productId = str(f, "productId", 24);
  const currency = str(f, "currency", 3);
  const qty = optInt(f, "qty", 1, 20) ?? 1;
  const amountRaw = str(f, "amount", 14);
  const note = str(f, "note", 500);
  const markPaid = f.get("markPaid") === "on";

  if (!NAME.test(mcName)) return fail("Player name may only contain letters, numbers, underscore and dot (max 32).");
  if (!OID.test(productId)) return fail("Pick a product.");
  if (!isCurrency(currency)) return fail("Pick a currency.");
  if (optInt(f, "qty", 1, 20) === null) return fail("Quantity must be 1-20.");
  const custom = amountRaw ? parseMoney(amountRaw) : undefined;
  if (custom === null) return fail("Amount received must be a number like 399 or 9.99.");

  await connectDB();
  const product = await Product.findById(productId);
  if (!product) return fail("Product not found.");

  const unitPrice = currency === "INR" ? product.price.inr : product.price.usd;
  const subtotal = unitPrice * qty;
  const total = custom ?? subtotal;
  const discount = Math.max(0, subtotal - total);

  // Take the stock first so two sales cannot oversell the last item.
  const limited = typeof product.stock === "number";
  if (limited) {
    const took = await Product.updateOne({ _id: product._id, stock: { $gte: qty } }, { $inc: { stock: -qty } });
    if (!took.modifiedCount) return fail(`Only ${product.stock} of "${product.name}" left in stock.`);
  }

  const player = await Player.findOne({ name: new RegExp(`^${escapeRe(mcName)}$`, "i") }).select("uuid name").lean();
  let order;
  try {
    order = await createOrder({
      mcName: player?.name ?? mcName,
      mcUuid: player?.uuid,
      items: [{ productId: product._id, slug: product.slug, name: product.name, qty, unitPrice }],
      currency,
      subtotal: Math.max(subtotal, total),
      discount,
      total,
      status: markPaid ? "paid" : "pending",
      provider: "manual",
      paidAt: markPaid ? new Date() : undefined,
      notes: note ? `[manual] ${user.username}: ${note}` : undefined,
      deliveryLog: [{ at: new Date(), step: "created manually", ok: true, message: `by ${user.username}` }],
    });
  } catch (e) {
    if (limited) await Product.updateOne({ _id: product._id }, { $inc: { stock: qty } });
    throw e;
  }
  const orderId = String(order._id);
  await audit(user, "store.order.create", order.orderNo, { mcName, product: product.slug, qty, currency, total, markPaid });

  let msg = `Order ${order.orderNo} created.`;
  if (markPaid) {
    const r = await deliverOrder(orderId);
    await audit(user, "store.order.deliver", order.orderNo, { ok: r.ok, message: r.message });
    msg += " " + (r.message ?? "");
    refreshStore();
    return goOrder(orderId, r.ok ? "ok" : "error", msg);
  }
  refreshStore();
  return goOrder(orderId, "ok", msg + " It is pending: mark it paid once the money arrived.");
}

export async function markOrderPaid(f: FormData) {
  const user = await requireRole("admin");
  const id = str(f, "id", 24);
  if (!OID.test(id)) return go("orders", "error", "Invalid request.");
  await connectDB();
  const order = await Order.findOneAndUpdate(
    { _id: id, provider: "manual", status: "pending" },
    { $set: { status: "paid", paidAt: new Date() }, $push: { deliveryLog: { at: new Date(), step: "marked paid", ok: true, message: `by ${user.username}` } } },
    { new: true }
  );
  if (!order) return goOrder(id, "error", "Only pending manual orders can be marked paid here. Gateway orders are paid through the payment provider.");
  const r = await deliverOrder(id);
  await audit(user, "store.order.paid", order.orderNo, { delivered: r.ok, message: r.message });
  refreshStore();
  return goOrder(id, r.ok ? "ok" : "error", r.ok ? `Marked paid. ${r.message}` : `Marked paid, but delivery failed: ${r.message}`);
}

export async function redeliverOrder(f: FormData) {
  const user = await requireRole("admin");
  const id = str(f, "id", 24);
  if (!OID.test(id)) return go("orders", "error", "Invalid request.");
  await connectDB();
  // Back to "paid" so deliverOrder will process it again. Existing entitlements are reused, so time is not added twice.
  const order = await Order.findOneAndUpdate(
    {
      _id: id,
      $or: [{ status: "delivered" }, { status: "failed", $or: [{ paidAt: { $exists: true, $ne: null } }, { "deliveryLog.step": "failed" }] }],
    },
    { $set: { status: "paid" }, $unset: { deliveredAt: 1 }, $push: { deliveryLog: { at: new Date(), step: "re-delivery requested", ok: true, message: `by ${user.username}` } } },
    { new: true }
  );
  if (!order) return goOrder(id, "error", "Only delivered orders, or paid orders whose delivery failed, can be re-delivered.");
  const r = await deliverOrder(id);
  await audit(user, "store.order.redeliver", order.orderNo, { ok: r.ok, message: r.message });
  refreshStore();
  return goOrder(id, r.ok ? "ok" : "error", r.message ?? (r.ok ? "Delivered." : "Delivery failed."));
}

/** Marks the order refunded and takes the rank/tag away. It does NOT contact the payment gateway. */
export async function refundOrder(f: FormData) {
  const user = await requireRole("admin");
  const id = str(f, "id", 24);
  if (!OID.test(id)) return go("orders", "error", "Invalid request.");
  if (f.get("confirm") !== "on") return goOrder(id, "error", "Tick the box to confirm you refunded the money in the gateway or by hand.");
  await connectDB();
  const order = await Order.findOneAndUpdate(
    { _id: id, status: { $in: ["paid", "delivered", "failed"] } },
    { $set: { status: "refunded", refundedAt: new Date() } },
    { new: true }
  );
  if (!order) return goOrder(id, "error", "Only paid, delivered or failed orders can be refunded.");
  const rev = await revokeOrderEntitlements(id, { createdBy: user.username });
  await Order.updateOne(
    { _id: id },
    { $push: { deliveryLog: { at: new Date(), step: "refunded", ok: true, message: `by ${user.username}; ${rev.revoked} entitlement(s) revoked. ${rev.messages.join(" ")}`.trim() } } }
  );
  await audit(user, "store.order.refund", order.orderNo, { revoked: rev.revoked, provider: order.provider, total: order.total });
  refreshStore();
  return goOrder(id, "ok", `Order marked refunded; ${rev.revoked} entitlement(s) revoked.`);
}

export async function cancelOrder(f: FormData) {
  const user = await requireRole("admin");
  const id = str(f, "id", 24);
  if (!OID.test(id)) return go("orders", "error", "Invalid request.");
  await connectDB();
  const order = await Order.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status: "cancelled" }, $push: { deliveryLog: { at: new Date(), step: "cancelled", ok: true, message: `by ${user.username}` } } },
    { new: true }
  );
  if (!order) return goOrder(id, "error", "Only pending orders can be cancelled.");
  // Give reserved stock back (manual orders take stock when they are created).
  if (order.provider === "manual") {
    for (const it of order.items) await Product.updateOne({ slug: it.slug, stock: { $type: "number" } }, { $inc: { stock: it.qty ?? 1 } });
  }
  await audit(user, "store.order.cancel", order.orderNo);
  refreshStore();
  return goOrder(id, "ok", "Order cancelled.");
}

export async function addOrderNote(f: FormData) {
  const user = await requireRole("admin");
  const id = str(f, "id", 24);
  const text = str(f, "note", 500);
  if (!OID.test(id)) return go("orders", "error", "Invalid request.");
  if (!text) return goOrder(id, "error", "Write a note first.");
  await connectDB();
  const line = `[${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC] ${user.username}: ${text}`;
  const res = await Order.updateOne({ _id: id }, [{ $set: { notes: { $concat: [{ $cond: [{ $gt: [{ $strLenCP: { $ifNull: ["$notes", ""] } }, 0] }, { $concat: ["$notes", "\n"] }, ""] }, { $literal: line }] } } }]);
  if (!res.matchedCount) return goOrder(id, "error", "Order not found.");
  await audit(user, "store.order.note", id, { text });
  refreshStore();
  return goOrder(id, "ok", "Note added.");
}
