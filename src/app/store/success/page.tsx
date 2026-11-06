import Link from "next/link";
import PageShell from "@/components/PageShell";
import AutoRefresh from "@/components/AutoRefresh";
import { connectDB } from "@/server/db";
import { Order } from "@/server/models/Store";
import { getCurrentUser } from "@/server/session";
import { ORDER_NO_RE, formatMoney } from "@/server/checkout/validate";
import "../checkout.css";

export const metadata = { title: "Order status — Turture SMP", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const COPY: Record<string, { title: string; text: string; tone: "ok" | "wait" | "err" }> = {
  pending: { title: "Waiting for payment confirmation", text: "We have not received the payment confirmation yet. This page updates by itself, it usually takes a few seconds.", tone: "wait" },
  paid: { title: "Payment received", text: "Thank you! Your purchase is being delivered to the server now.", tone: "wait" },
  delivered: { title: "Delivered", text: "Your purchase is active. Join the server and enjoy. If something looks missing, relog once.", tone: "ok" },
  failed: { title: "Payment problem", text: "This order could not be completed. If money left your account, contact staff on Discord with your order number.", tone: "err" },
  refunded: { title: "Refunded", text: "This order was refunded.", tone: "err" },
  cancelled: { title: "Cancelled", text: "This order was cancelled.", tone: "err" },
};

export default async function Success({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: orderNo } = await searchParams;
  const user = await getCurrentUser().catch(() => null);

  let order: Awaited<ReturnType<typeof load>> = null;
  if (user && orderNo && ORDER_NO_RE.test(orderNo)) {
    try {
      order = await load(orderNo, user.id);
    } catch {
      order = null;
    }
  }

  return (
    <PageShell title="Order status" art="diamond">
      <div className="co-wrap single">
        <div className="card co-card">
          {!user ? (
            <>
              <h2>Log in to see your order</h2>
              <p className="muted">Order details are only shown to the account that placed them.</p>
              <Link className="btn discord" href={`/login?next=${encodeURIComponent(`/store/success?order=${orderNo || ""}`)}`}>Log in</Link>
            </>
          ) : !order ? (
            <>
              <h2>Order not found</h2>
              <p className="muted">We could not find that order on your account.</p>
              <Link className="btn primary" href="/store">Back to the store</Link>
            </>
          ) : (
            <>
              {(order.status === "pending" || order.status === "paid") && <AutoRefresh />}
              <span className={`co-status ${COPY[order.status]?.tone || "wait"}`}>{order.status}</span>
              <h2>{COPY[order.status]?.title || order.status}</h2>
              <p className="muted">{COPY[order.status]?.text}</p>
              <dl className="co-dl">
                <div><dt>Order</dt><dd><code>{order.orderNo}</code></dd></div>
                <div><dt>Item</dt><dd>{order.items.map((i: { name: string }) => i.name).join(", ")}</dd></div>
                <div><dt>Player</dt><dd>{order.mcName}</dd></div>
                <div><dt>Total</dt><dd>{formatMoney(order.total, order.currency as "INR" | "USD")}</dd></div>
              </dl>
              <Link className="btn primary" href="/store">Back to the store</Link>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}

async function load(orderNo: string, userId: string) {
  if (!process.env.MONGODB_URI) return null;
  await connectDB();
  // Scoped by userId: only the owner of the order can see it.
  const o = await Order.findOne({ orderNo, userId }).lean();
  if (!o) return null;
  return {
    orderNo: o.orderNo,
    status: o.status as string,
    mcName: o.mcName,
    total: o.total,
    currency: o.currency as string,
    items: ((o.items || []) as { name?: string; slug?: string }[]).map((i) => ({ name: String(i.name || i.slug || "Item") })),
  };
}
