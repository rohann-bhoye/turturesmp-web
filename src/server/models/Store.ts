import { Schema } from "mongoose";
import { model } from "../db";

// ---------- products (what you sell) ----------
export const PRODUCT_TYPES = ["rank", "tag", "role", "key", "bundle", "other"] as const;

const ProductSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    type: { type: String, enum: PRODUCT_TYPES, required: true, index: true },
    description: String,
    perks: [String],
    color: { type: String, default: "#55e03a" },
    // Smallest currency unit: paise for INR, cents for USD.
    price: { inr: { type: Number, required: true, min: 0 }, usd: { type: Number, required: true, min: 0 } },
    durationDays: Number, // empty = permanent
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true },
    stock: Number, // empty = unlimited
    sortOrder: { type: Number, default: 0 },
    // What the buyer receives after paying (run by the bridge plugin / Discord bot).
    grants: {
      rankKey: String,
      tagKey: String,
      discordRoleId: String,
      commands: [String], // placeholders: {player} {uuid}
    },
  },
  { timestamps: true }
);
export const Product = model("Product", ProductSchema);

// ---------- coupons ----------
const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    percentOff: { type: Number, min: 0, max: 100 },
    amountOff: { inr: Number, usd: Number },
    maxUses: Number,
    used: { type: Number, default: 0 },
    expiresAt: Date,
    productSlugs: [String], // empty = all products
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export const Coupon = model("Coupon", CouponSchema);

// ---------- orders ----------
export const ORDER_STATUS = ["pending", "paid", "delivered", "failed", "refunded", "cancelled"] as const;

const OrderSchema = new Schema(
  {
    orderNo: { type: String, required: true, unique: true }, // e.g. TSMP-20261106-0001
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    mcName: { type: String, required: true },
    mcUuid: String,
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product" },
        slug: String,
        name: String,
        qty: { type: Number, default: 1 },
        unitPrice: Number,
      },
    ],
    currency: { type: String, enum: ["INR", "USD"], required: true },
    subtotal: Number,
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    couponCode: String,
    status: { type: String, enum: ORDER_STATUS, default: "pending", index: true },
    provider: { type: String, enum: ["razorpay", "cashfree", "stripe", "paypal", "manual"], required: true },
    providerOrderId: { type: String, index: true },
    providerPaymentId: String,
    paidAt: Date,
    deliveredAt: Date,
    refundedAt: Date,
    deliveryLog: [{ at: { type: Date, default: Date.now }, step: String, ok: Boolean, message: String }],
    notes: String,
  },
  { timestamps: true }
);
export const Order = model("Order", OrderSchema);

// ---------- entitlements: what a player currently owns (handles expiry/renewal) ----------
const EntitlementSchema = new Schema(
  {
    playerUuid: { type: String, required: true, index: true },
    playerName: String,
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    productSlug: { type: String, required: true },
    type: { type: String, enum: PRODUCT_TYPES, required: true },
    startsAt: { type: Date, default: Date.now },
    expiresAt: Date, // empty = permanent
    active: { type: Boolean, default: true, index: true },
    revokedAt: Date,
  },
  { timestamps: true }
);
export const Entitlement = model("Entitlement", EntitlementSchema);
