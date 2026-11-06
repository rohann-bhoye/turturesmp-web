import Link from "next/link";
import { connectDB } from "@/server/db";
import { ORDER_STATUS, Order, Product } from "@/server/models/Store";
import { formatMoney } from "@/server/store/pricing";
import { createManualOrder } from "../actions";
import { fmtDate, statusClass, storeHref } from "../_lib";

const PAGE = 30;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Props = { status?: string; q?: string; page?: string; showNew: boolean; canEdit: boolean };

export default async function OrdersTab({ status, q, page, showNew, canEdit }: Props) {
  await connectDB();
  const search = (q ?? "").trim().slice(0, 40);
  const st = (ORDER_STATUS as readonly string[]).includes(status ?? "") ? status : undefined;
  const pageNo = Math.min(1000, Math.max(1, Math.floor(Number(page)) || 1));

  const filter: Record<string, unknown> = {};
  if (st) filter.status = st;
  if (search) {
    const re = new RegExp(escapeRe(search), "i");
    filter.$or = [{ orderNo: re }, { mcName: re }];
  }

  const [rows, products] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNo - 1) * PAGE)
      .limit(PAGE + 1)
      .select("orderNo mcName items currency total status provider createdAt")
      .lean(),
    showNew && canEdit ? Product.find({ active: true }).sort({ sortOrder: 1 }).select("name slug price").lean() : Promise.resolve([]),
  ]);
  const hasNext = rows.length > PAGE;
  const orders = rows.slice(0, PAGE);
  const link = (p: number) => storeHref({ tab: "orders", status: st, q: search, page: p > 1 ? p : undefined });

  return (
    <>
      <div className="st-head">
        <h2>Orders</h2>
        {canEdit && <div><Link className="btn primary sm" href={storeHref({ tab: "orders", new: "1" })}>New manual order</Link></div>}
      </div>

      {showNew && canEdit && (
        <form action={createManualOrder} className="settings st-form">
          <fieldset className="card">
            <legend>New manual order</legend>
            <p className="st-note">For sales handled outside the website (UPI, cash, bank transfer). Tick &quot;already paid&quot; to deliver the rank straight away.</p>
            <div className="row">
              <label className="field"><span>Minecraft name</span><input name="mcName" required maxLength={32} placeholder="Steve" autoComplete="off" /></label>
              <label className="field">
                <span>Product</span>
                <select name="productId" required defaultValue="">
                  <option value="" disabled>Choose a product</option>
                  {products.map((p) => <option key={String(p._id)} value={String(p._id)}>{p.name} ({formatMoney(p.price.inr, "INR")} / {formatMoney(p.price.usd, "USD")})</option>)}
                </select>
              </label>
              <label className="field narrow"><span>Quantity</span><input name="qty" type="number" min={1} max={20} defaultValue={1} /></label>
            </div>
            <div className="row">
              <label className="field narrow"><span>Currency</span><select name="currency" defaultValue="INR"><option>INR</option><option>USD</option></select></label>
              <label className="field narrow"><span>Amount received</span><input name="amount" inputMode="decimal" placeholder="list price" /></label>
              <label className="field"><span>Note (optional)</span><input name="note" maxLength={500} placeholder="e.g. paid by UPI, ref 1234" /></label>
            </div>
            <label className="check"><input type="checkbox" name="markPaid" defaultChecked /><span><b>Already paid</b><small>Marks it paid and delivers it now. The player must have joined the server once.</small></span></label>
          </fieldset>
          <div className="st-actions">
            <button className="btn primary" type="submit">Create order</button>
            <Link className="btn ghost" href={storeHref({ tab: "orders" })}>Cancel</Link>
          </div>
        </form>
      )}

      <form className="st-filter" method="get" action="/admin/store">
        <input type="hidden" name="tab" value="orders" />
        <label className="field"><span>Search order number or player</span><input name="q" defaultValue={search} placeholder="TSMP-2026… or Steve" maxLength={40} /></label>
        <label className="field narrow">
          <span>Status</span>
          <select name="status" defaultValue={st ?? ""}>
            <option value="">All</option>
            {ORDER_STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <button className="btn ghost sm" type="submit">Filter</button>
        {(st || search) && <Link className="btn ghost sm" href={storeHref({ tab: "orders" })}>Clear</Link>}
      </form>

      <div className="card table-wrap">
        {orders.length ? (
          <table>
            <thead><tr><th>Order</th><th>Player</th><th>Items</th><th className="st-num">Total</th><th>Status</th><th>Via</th><th>Date</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={String(o._id)}>
                  <td className="st-nowrap"><Link className="st-link" href={`/admin/store/orders/${o._id}`}>{o.orderNo}</Link></td>
                  <td>{o.mcName}</td>
                  <td>{o.items.map((i: { name?: string | null; slug?: string | null; qty?: number | null }) => `${i.name || i.slug}${(i.qty ?? 1) > 1 ? ` ×${i.qty}` : ""}`).join(", ") || "—"}</td>
                  <td className="st-num">{formatMoney(o.total, o.currency as "INR" | "USD")}</td>
                  <td><span className={statusClass(o.status)}>{o.status}</span></td>
                  <td>{o.provider}</td>
                  <td className="st-nowrap">{fmtDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="st-empty">{st || search ? "No orders match this filter." : "No orders yet."}</p>
        )}
      </div>

      {(pageNo > 1 || hasNext) && (
        <div className="st-pager">
          {pageNo > 1 ? <Link className="btn ghost sm" href={link(pageNo - 1)}>← Newer</Link> : <span />}
          <span>Page {pageNo}</span>
          {hasNext ? <Link className="btn ghost sm" href={link(pageNo + 1)}>Older →</Link> : <span />}
        </div>
      )}
    </>
  );
}
