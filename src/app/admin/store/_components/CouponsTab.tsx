import Link from "next/link";
import { connectDB } from "@/server/db";
import { Coupon, Product } from "@/server/models/Store";
import { formatMoney, toMajorInput } from "@/server/store/pricing";
import { deleteCoupon, saveCoupon } from "../actions";
import { fmtDay, storeHref, toDateInput } from "../_lib";

export default async function CouponsTab({ edit }: { edit?: string }) {
  await connectDB();
  const [coupons, products] = await Promise.all([Coupon.find().sort({ createdAt: -1 }).limit(300).lean(), Product.find().sort({ sortOrder: 1 }).select("slug name").lean()]);
  const c = edit && edit !== "new" ? coupons.find((x) => String(x._id) === edit) : undefined;
  const showForm = edit === "new" || !!c;
  const now = Date.now();

  const discountText = (x: (typeof coupons)[number]) =>
    [
      x.percentOff ? `${x.percentOff}%` : "",
      x.amountOff?.inr ? formatMoney(x.amountOff.inr, "INR") : "",
      x.amountOff?.usd ? formatMoney(x.amountOff.usd, "USD") : "",
    ]
      .filter(Boolean)
      .join(" + ") || "—";
  const state = (x: (typeof coupons)[number]) => {
    if (!x.active) return "off";
    if (x.expiresAt && new Date(x.expiresAt).getTime() <= now) return "expired";
    if (x.maxUses != null && (x.used ?? 0) >= x.maxUses) return "expired";
    return "active";
  };

  return (
    <>
      <div className="st-head">
        <h2>Coupons</h2>
        <div><Link className="btn primary sm" href={storeHref({ tab: "coupons", edit: "new" })}>New coupon</Link></div>
      </div>

      {showForm && (
        <form action={saveCoupon} className="settings st-form" key={c ? String(c._id) : "new"}>
          <input type="hidden" name="id" value={c ? String(c._id) : ""} />
          <fieldset className="card">
            <legend>{c ? `Edit ${c.code}` : "New coupon"}</legend>
            <div className="row">
              <label className="field"><span>Code</span><input name="code" defaultValue={c?.code} required maxLength={32} placeholder="WELCOME10" style={{ textTransform: "uppercase" }} /></label>
              <label className="field narrow"><span>Percent off</span><input name="percentOff" inputMode="decimal" defaultValue={c?.percentOff ?? ""} placeholder="e.g. 10" /></label>
              <label className="field narrow"><span>Amount off ₹</span><input name="amountInr" inputMode="decimal" defaultValue={toMajorInput(c?.amountOff?.inr)} placeholder="e.g. 50" /></label>
              <label className="field narrow"><span>Amount off $</span><input name="amountUsd" inputMode="decimal" defaultValue={toMajorInput(c?.amountOff?.usd)} placeholder="e.g. 1" /></label>
            </div>
            <p className="st-note">Use a percentage, a fixed amount, or both (they add up). A fixed amount only works for currencies where you filled it in. The total never goes below 0.</p>
            <div className="row">
              <label className="field narrow"><span>Max uses</span><input name="maxUses" type="number" min={1} defaultValue={c?.maxUses ?? ""} placeholder="unlimited" /></label>
              <label className="field narrow"><span>Expires (end of day, UTC)</span><input name="expiresAt" type="date" defaultValue={toDateInput(c?.expiresAt)} /></label>
              {c && <label className="field narrow"><span>Used so far</span><input value={c.used ?? 0} readOnly tabIndex={-1} /></label>}
            </div>
            <label className="field">
              <span>Only for these products (none selected = everything)</span>
              <select name="productSlugs" multiple size={Math.min(8, Math.max(3, products.length))} defaultValue={c?.productSlugs ?? []}>
                {products.map((p) => <option key={p.slug} value={p.slug}>{p.name} ({p.slug})</option>)}
              </select>
              <small>Hold Ctrl / Cmd (or long-press on a phone) to pick several.</small>
            </label>
            <label className="check"><input type="checkbox" name="active" defaultChecked={c ? c.active : true} /><span><b>Active</b><small>Untick to stop it working without deleting it.</small></span></label>
          </fieldset>
          <div className="st-actions">
            <button className="btn primary" type="submit">Save coupon</button>
            <Link className="btn ghost" href={storeHref({ tab: "coupons" })}>Cancel</Link>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        {coupons.length ? (
          <table>
            <thead><tr><th>Code</th><th>Discount</th><th>Used</th><th>Expires</th><th>Products</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {coupons.map((x) => {
                const s = state(x);
                return (
                  <tr key={String(x._id)}>
                    <td>{x.code}</td>
                    <td>{discountText(x)}</td>
                    <td>{x.used ?? 0}{x.maxUses != null ? ` / ${x.maxUses}` : ""}</td>
                    <td className="st-nowrap">{x.expiresAt ? fmtDay(x.expiresAt) : "Never"}</td>
                    <td>{x.productSlugs?.length ? x.productSlugs.join(", ") : "All"}</td>
                    <td><span className={`st-chip s-${s}`}>{s === "off" ? "inactive" : s}</span></td>
                    <td>
                      <div className="st-actions">
                        <Link className="btn ghost sm" href={storeHref({ tab: "coupons", edit: String(x._id) })}>Edit</Link>
                        <form action={deleteCoupon}>
                          <input type="hidden" name="id" value={String(x._id)} />
                          <button className="btn ghost sm" title={(x.used ?? 0) > 0 ? "Already used: will be deactivated, not deleted" : "Delete this coupon"}>{(x.used ?? 0) > 0 ? "Deactivate" : "Delete"}</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="st-empty">No coupons yet.</p>
        )}
      </div>
    </>
  );
}
