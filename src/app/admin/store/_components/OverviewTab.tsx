import Link from "next/link";
import { connectDB } from "@/server/db";
import { ORDER_STATUS, Order } from "@/server/models/Store";
import { formatMoney, isCurrency, type Currency } from "@/server/store/pricing";
import { statusClass, storeHref } from "../_lib";

const money = (cur: string, minor: number) => (isCurrency(cur) ? formatMoney(minor, cur as Currency) : `${minor / 100} ${cur}`);

export default async function OverviewTab() {
  await connectDB();
  const since = new Date(Date.now() - 30 * 864e5);
  const sold = { status: { $in: ["paid", "delivered"] }, createdAt: { $gte: since } };

  const [revenue, byStatus, top] = await Promise.all([
    Order.aggregate<{ _id: string; total: number; count: number }>([{ $match: sold }, { $group: { _id: "$currency", total: { $sum: "$total" }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Order.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate<{ _id: { slug: string; currency: string }; name: string; units: number; revenue: number }>([
      { $match: sold },
      { $unwind: "$items" },
      {
        $group: {
          _id: { slug: "$items.slug", currency: "$currency" },
          name: { $first: "$items.name" },
          units: { $sum: { $ifNull: ["$items.qty", 1] } },
          revenue: { $sum: { $multiply: [{ $ifNull: ["$items.qty", 1] }, { $ifNull: ["$items.unitPrice", 0] }] } },
        },
      },
      { $sort: { units: -1, revenue: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const counts = new Map(byStatus.map((s) => [s._id, s.count]));
  const maxCount = Math.max(1, ...byStatus.map((s) => s.count));
  const totalOrders = byStatus.reduce((a, s) => a + s.count, 0);
  const attention = (counts.get("failed") ?? 0) + (counts.get("pending") ?? 0);
  const paidCount = revenue.reduce((a, r) => a + r.count, 0);

  return (
    <>
      <h2>Last 30 days</h2>
      <div className="kpis">
        {revenue.length ? (
          revenue.map((r) => (
            <div className="kpi" key={r._id}>
              <span>Revenue {r._id}</span>
              <b>{money(r._id, r.total)}</b>
              <small className="muted">{r.count} order{r.count === 1 ? "" : "s"}</small>
            </div>
          ))
        ) : (
          <div className="kpi"><span>Revenue</span><b>—</b><small className="muted">No paid orders yet</small></div>
        )}
        <div className="kpi"><span>Paid orders</span><b>{paidCount}</b></div>
        <div className="kpi">
          <span>Needs attention</span>
          <b>{attention}</b>
          <small className="muted"><Link className="st-link" href={storeHref({ tab: "orders", status: "failed" })}>failed</Link> + <Link className="st-link" href={storeHref({ tab: "orders", status: "pending" })}>pending</Link></small>
        </div>
      </div>

      <div className="st-grid2">
        <div className="card">
          <h3>Orders by status</h3>
          <p className="st-note">All time, {totalOrders} total.</p>
          <div className="st-bars">
            {ORDER_STATUS.map((s) => {
              const n = counts.get(s) ?? 0;
              return (
                <Link key={s} className="st-bar" href={storeHref({ tab: "orders", status: s })}>
                  <span><span className={statusClass(s)}>{s}</span></span>
                  <i><b style={{ width: n ? `${Math.max(3, (n / maxCount) * 100)}%` : 0 }} /></i>
                  <span>{n}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="card table-wrap">
          <h3 style={{ padding: "10px 14px 0" }}>Top products</h3>
          {top.length ? (
            <table>
              <thead><tr><th>Product</th><th className="st-num">Sold</th><th className="st-num">Revenue</th></tr></thead>
              <tbody>
                {top.map((t) => (
                  <tr key={`${t._id.slug}-${t._id.currency}`}>
                    <td>{t.name || t._id.slug}</td>
                    <td className="st-num">{t.units}</td>
                    <td className="st-num">{money(t._id.currency, t.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="st-empty">No sales in the last 30 days.</p>
          )}
        </div>
      </div>
    </>
  );
}
