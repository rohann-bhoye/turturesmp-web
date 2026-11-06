import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDB } from "@/server/db";
import { requireRole } from "@/server/guard";
import { hasRole } from "@/server/roles";
import { BridgeCommand } from "@/server/models/BridgeCommand";
import { Entitlement, Order } from "@/server/models/Store";
import { formatMoney, type Currency } from "@/server/store/pricing";
import { addOrderNote, cancelOrder, markOrderPaid, redeliverOrder, refundOrder } from "../../actions";
import { fmtDate, statusClass, storeHref } from "../../_lib";
import "../../../store.css";

export const metadata = { title: "Order — Turture SMP" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireRole("viewer");
  const admin = hasRole(user.role, "admin");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();

  await connectDB();
  const order = await Order.findById(id).lean();
  if (!order) notFound();
  const [commands, ents] = await Promise.all([
    BridgeCommand.find({ orderId: order._id }).sort({ createdAt: 1 }).limit(100).lean(),
    Entitlement.find({ orderId: order._id }).sort({ createdAt: 1 }).lean(),
  ]);
  const cur = order.currency as Currency;
  const s = order.status;
  const canPay = admin && order.provider === "manual" && s === "pending";
  const canRedeliver = admin && (s === "delivered" || (s === "failed" && (!!order.paidAt || order.deliveryLog.some((l: LogRow) => l.step === "failed"))));
  const canRefund = admin && (s === "paid" || s === "delivered" || s === "failed");
  const canCancel = admin && s === "pending";

  return (
    <div className="st">
      <div className="st-head">
        <div>
          <Link className="muted back" href={storeHref({ tab: "orders" })}>← All orders</Link>
        </div>
      </div>
      <div className="st-head">
        <h1 className="admin-h" style={{ marginBottom: 0 }}>{order.orderNo}</h1>
        <span className={statusClass(s)}>{s}</span>
      </div>
      {sp.ok && <p className="notice ok" role="status">{sp.ok}</p>}
      {sp.error && <p className="notice err" role="alert">{sp.error}</p>}

      <div className="st-grid2">
        <div className="card">
          <h3>Order</h3>
          <dl className="st-dl">
            <dt>Player</dt><dd>{order.mcName}{order.mcUuid && <><br /><small className="muted">{order.mcUuid}</small></>}</dd>
            <dt>Payment via</dt><dd>{order.provider}</dd>
            <dt>Provider order</dt><dd>{order.providerOrderId || "—"}</dd>
            <dt>Provider payment</dt><dd>{order.providerPaymentId || "—"}</dd>
            <dt>Coupon</dt><dd>{order.couponCode || "—"}</dd>
            <dt>Created</dt><dd>{fmtDate(order.createdAt)}</dd>
            <dt>Paid</dt><dd>{fmtDate(order.paidAt)}</dd>
            <dt>Delivered</dt><dd>{s === "delivered" ? fmtDate(order.deliveredAt) : "—"}</dd>
            {order.refundedAt && <><dt>Refunded</dt><dd>{fmtDate(order.refundedAt)}</dd></>}
          </dl>
        </div>

        <div className="card table-wrap">
          <h3 style={{ padding: "10px 14px 0" }}>Items</h3>
          <table style={{ minWidth: 0 }}>
            <thead><tr><th>Item</th><th className="st-num">Qty</th><th className="st-num">Price</th></tr></thead>
            <tbody>
              {order.items.map((i: ItemRow, n: number) => (
                <tr key={n}>
                  <td>{i.name || i.slug}<br /><small>{i.slug}</small></td>
                  <td className="st-num">{i.qty ?? 1}</td>
                  <td className="st-num">{formatMoney((i.unitPrice ?? 0) * (i.qty ?? 1), cur)}</td>
                </tr>
              ))}
              <tr><td colSpan={2}>Subtotal</td><td className="st-num">{formatMoney(order.subtotal ?? order.total, cur)}</td></tr>
              {!!order.discount && <tr><td colSpan={2}>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</td><td className="st-num">-{formatMoney(order.discount, cur)}</td></tr>}
              <tr className="st-total"><td colSpan={2}>Total</td><td className="st-num">{formatMoney(order.total, cur)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {admin && (
        <div className="card">
          <h3>Actions</h3>
          <div className="st-actions" style={{ marginTop: 12 }}>
            {canPay && (
              <form action={markOrderPaid}>
                <input type="hidden" name="id" value={id} />
                <button className="btn primary sm">Mark paid &amp; deliver</button>
              </form>
            )}
            {canRedeliver && (
              <form action={redeliverOrder}>
                <input type="hidden" name="id" value={id} />
                <button className="btn gold sm" title="Sends the rank, tag and commands to the server again">Re-deliver</button>
              </form>
            )}
            {canCancel && (
              <form action={cancelOrder}>
                <input type="hidden" name="id" value={id} />
                <button className="btn ghost sm">Cancel order</button>
              </form>
            )}
            {!canPay && !canRedeliver && !canCancel && !canRefund && <span className="st-note">No actions available for a {s} order.</span>}
          </div>
          {canRedeliver && <p className="st-note" style={{ marginTop: 10 }}>Re-delivery sends the rank/tag and every console command again. Time already granted is not added twice.</p>}
          {s === "failed" && <p className="st-note" style={{ marginTop: 6 }}>Delivery failed: read the log below, fix the cause (for example the player must join once, or the rank must exist), then re-deliver.</p>}

          {canRefund && (
            <form action={refundOrder} className="st-form" style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <input type="hidden" name="id" value={id} />
              <p className="st-note">
                <b>Refunds do not move money.</b> This only marks the order refunded and removes the rank/tag. Refund the payment in the {order.provider === "manual" ? "same way you received it (UPI, cash...)" : `${order.provider} dashboard`} yourself. One-time console commands (keys, items) cannot be undone.
              </p>
              <label className="check"><input type="checkbox" name="confirm" required /><span><b>I have refunded the money</b><small>Required to continue.</small></span></label>
              <div><button className="btn st-danger sm">Mark refunded &amp; revoke</button></div>
            </form>
          )}
        </div>
      )}

      <div className="st-grid2">
        <div className="card">
          <h3>Delivery log</h3>
          {order.deliveryLog.length ? (
            <ul className="st-log">
              {order.deliveryLog.map((l: LogRow, n: number) => (
                <li key={n} className={l.ok === false ? "bad" : undefined}>
                  <span>
                    <b>{l.step}</b>
                    {l.message && <small>{l.message}</small>}
                    <small>{fmtDate(l.at)}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="st-note" style={{ marginTop: 8 }}>Nothing yet.</p>
          )}
        </div>

        <div className="card table-wrap">
          <h3 style={{ padding: "10px 14px 0" }}>Server commands &amp; entitlements</h3>
          {commands.length || ents.length ? (
            <table style={{ minWidth: 0 }}>
              <thead><tr><th>What</th><th>Status</th></tr></thead>
              <tbody>
                {commands.map((c) => (
                  <tr key={String(c._id)}>
                    <td>{c.type}<br /><small>{summarize(c.payload)}</small>{c.message && <><br /><small>{c.message}</small></>}</td>
                    <td><span className={`st-chip ${c.status === "done" ? "s-delivered" : c.status === "failed" ? "s-failed" : "s-pending"}`}>{c.status}</span></td>
                  </tr>
                ))}
                {ents.map((e) => (
                  <tr key={String(e._id)}>
                    <td>owns {e.productSlug}<br /><small>{e.expiresAt ? `until ${fmtDate(e.expiresAt)}` : "permanent"}</small></td>
                    <td><span className={`st-chip ${e.active ? "s-active" : "s-archived"}`}>{e.active ? "active" : "revoked"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="st-empty">Nothing queued for this order.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Notes</h3>
        {order.notes ? <p className="st-pre">{order.notes}</p> : <p className="st-note" style={{ marginTop: 8 }}>No notes.</p>}
        {admin && (
          <form action={addOrderNote} className="row" style={{ marginTop: 14, alignItems: "flex-end" }}>
            <input type="hidden" name="id" value={id} />
            <label className="field"><span>Add a note</span><input name="note" maxLength={500} required placeholder="Visible to staff only" /></label>
            <button className="btn ghost sm">Add note</button>
          </form>
        )}
      </div>
    </div>
  );
}

function summarize(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  const text = typeof p.command === "string" ? p.command : [p.name, p.rankKey, p.tagKey].filter((v) => typeof v === "string").join(" · ");
  return String(text).slice(0, 120);
}

type ItemRow = { name?: string | null; slug?: string | null; qty?: number | null; unitPrice?: number | null };
type LogRow = { at?: Date | null; step?: string | null; ok?: boolean | null; message?: string | null };
