import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/server/db";
import { Coupon, Order, Product } from "@/server/models/Store";
import { getCurrentUser } from "@/server/session";
import { applyCoupon } from "@/server/checkout/coupon";
import { createRazorpayOrder, createStripeSession, gatewayConfig, siteUrl } from "@/server/checkout/gateways";
import { MIN_TOTAL, formatMoney, isCurrency, isEdition, makeOrderNo, normalizeCouponCode, validateMcName } from "@/server/checkout/validate";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request.");
  }

  const user = await getCurrentUser();
  if (!user) return fail("Please log in to buy.", 401);

  const edition = body.edition;
  if (!isEdition(edition)) return fail("Choose Java or Bedrock edition.");
  const mcName = validateMcName(body.mcName, edition);
  if (!mcName) {
    return fail(edition === "bedrock" ? "Bedrock names are 3-16 letters, numbers, underscores or spaces (may start with a dot)." : "Java names are 3-16 letters, numbers or underscores.");
  }
  const currency = body.currency;
  if (!isCurrency(currency)) return fail("Choose INR or USD.");
  if (typeof body.slug !== "string" || !body.slug) return fail("Unknown product.");

  const cfg = gatewayConfig();
  if (currency === "INR" ? !cfg.razorpay : !cfg.stripe) return fail("This payment method is not available right now.", 503);

  try {
    await connectDB();

    // Light abuse guard: too many unpaid orders created recently by one account.
    const recent = await Order.countDocuments({ userId: user.id, status: "pending", createdAt: { $gt: new Date(Date.now() - 10 * 60_000) } });
    if (recent >= 8) return fail("Too many unfinished orders. Please wait a few minutes.", 429);

    // The price always comes from the database, never from the browser.
    const product = await Product.findOne({ slug: body.slug.toLowerCase(), active: true });
    if (!product) return fail("This product is not available.", 404);
    if (product.stock != null && product.stock <= 0) return fail("This product is sold out.", 409);
    const unitPrice = currency === "INR" ? product.price.inr : product.price.usd;
    const subtotal = unitPrice;
    let discount = 0;
    let total = subtotal;
    let couponCode: string | undefined;

    const code = normalizeCouponCode(body.coupon);
    if (code) {
      const coupon = await Coupon.findOne({ code }).lean();
      const r = applyCoupon({ coupon, subtotal, currency, productSlug: product.slug });
      if (!r.ok) return fail(r.error);
      discount = r.discount;
      total = r.total;
      couponCode = code;
    }
    if (total < MIN_TOTAL[currency]) return fail(`The minimum payable amount is ${formatMoney(MIN_TOTAL[currency], currency)}.`);

    let order = null;
    for (let i = 0; i < 6 && !order; i++) {
      try {
        order = await Order.create({
          orderNo: makeOrderNo(),
          userId: user.id,
          mcName,
          items: [{ productId: product._id, slug: product.slug, name: product.name, qty: 1, unitPrice }],
          currency,
          subtotal,
          discount,
          total,
          couponCode,
          status: "pending",
          provider: currency === "INR" ? "razorpay" : "stripe",
          notes: `edition=${edition}`,
        });
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e; // retry only on an orderNo collision
      }
    }
    if (!order) return fail("Could not create the order. Try again.", 500);

    const origin = siteUrl(req.nextUrl.origin);
    try {
      if (currency === "INR") {
        const rz = await createRazorpayOrder({ amount: total, receipt: order.orderNo, orderNo: order.orderNo });
        order.providerOrderId = rz.id;
        await order.save();
        return NextResponse.json({
          ok: true,
          provider: "razorpay",
          orderNo: order.orderNo,
          razorpay: {
            key: rz.keyId,
            order_id: rz.id,
            amount: total,
            currency: "INR",
            name: "Turture SMP",
            description: `${product.name} for ${mcName}`,
            prefill: { name: user.username },
            theme: { color: "#17a85a" },
          },
        });
      }
      const s = await createStripeSession({
        amount: total,
        currency,
        productName: `${product.name} (${mcName})`,
        orderNo: order.orderNo,
        successUrl: `${origin}/store/success?order=${order.orderNo}`,
        cancelUrl: `${origin}/store/checkout/${product.slug}?cancelled=1`,
      });
      order.providerOrderId = s.id;
      await order.save();
      return NextResponse.json({ ok: true, provider: "stripe", orderNo: order.orderNo, url: s.url });
    } catch (e) {
      const message = e instanceof Error ? e.message : "gateway error";
      console.error(`[checkout] gateway order failed for ${order.orderNo}: ${message}`);
      await Order.updateOne({ _id: order._id }, { $set: { status: "failed" }, $push: { deliveryLog: { at: new Date(), step: "gateway", ok: false, message } } });
      return fail("Could not start the payment. Please try again later.", 502);
    }
  } catch (e) {
    console.error("[checkout] create failed:", e instanceof Error ? e.message : "unknown");
    return fail("Store is unavailable right now.", 503);
  }
}
