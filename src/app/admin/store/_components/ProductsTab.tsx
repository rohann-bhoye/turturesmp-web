import Link from "next/link";
import { connectDB } from "@/server/db";
import { Order, Product } from "@/server/models/Store";
import { Rank, Tag } from "@/server/models/Rank";
import { formatMoney, toMajorInput } from "@/server/store/pricing";
import { PRODUCT_TYPES } from "@/server/models/Store";
import { deleteProduct, saveProduct, seedProducts } from "../actions";
import { storeHref } from "../_lib";

export default async function ProductsTab({ edit }: { edit?: string }) {
  await connectDB();
  const [products, ranks, tags, usedSlugs] = await Promise.all([
    Product.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
    Rank.find().sort({ weight: 1 }).select("key displayName").lean(),
    Tag.find().sort({ key: 1 }).select("key display").lean(),
    Order.distinct("items.slug") as Promise<string[]>,
  ]);
  const used = new Set(usedSlugs);
  const current = edit && edit !== "new" ? products.find((p) => String(p._id) === edit) : undefined;
  const showForm = edit === "new" || !!current;
  const p = current;

  const rankKeys = new Set(ranks.map((r) => r.key));
  const tagKeys = new Set(tags.map((t) => t.key));

  return (
    <>
      <div className="st-head">
        <h2>Products</h2>
        <div>
          <form action={seedProducts}>
            <button className="btn ghost sm" title="Creates one product per rank card on the website. Existing ones are not changed.">Seed from website ranks</button>
          </form>
          <Link className="btn primary sm" href={storeHref({ tab: "products", edit: "new" })}>New product</Link>
        </div>
      </div>

      {showForm && (
        <form action={saveProduct} className="settings st-form" key={p ? String(p._id) : "new"}>
          <input type="hidden" name="id" value={p ? String(p._id) : ""} />
          <fieldset className="card">
            <legend>{p ? `Edit ${p.name}` : "New product"}</legend>
            <div className="row">
              <label className="field"><span>Name</span><input name="name" defaultValue={p?.name} required maxLength={60} placeholder="Gold Rank" /></label>
              <label className="field">
                <span>Slug (cannot change later)</span>
                <input name="slug" defaultValue={p?.slug} required maxLength={40} pattern="[a-z0-9][a-z0-9\-]*" readOnly={!!p} placeholder="gold" />
              </label>
              <label className="field narrow">
                <span>Type</span>
                <select name="type" defaultValue={p?.type ?? "rank"}>{PRODUCT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              </label>
            </div>
            <label className="field"><span>Description</span><textarea name="description" defaultValue={p?.description ?? ""} maxLength={500} rows={2} /></label>
            <label className="field"><span>Perks (one per line)</span><textarea name="perks" defaultValue={(p?.perks ?? []).join("\n")} rows={5} /></label>
            <div className="row">
              <label className="field narrow"><span>Price ₹ (INR)</span><input name="priceInr" inputMode="decimal" required defaultValue={toMajorInput(p?.price?.inr)} placeholder="399" /></label>
              <label className="field narrow"><span>Price $ (USD)</span><input name="priceUsd" inputMode="decimal" required defaultValue={toMajorInput(p?.price?.usd)} placeholder="4.99" /></label>
              <label className="field narrow"><span>Duration (days)</span><input name="durationDays" type="number" min={1} max={3650} defaultValue={p?.durationDays ?? ""} placeholder="empty = permanent" /></label>
              <label className="field narrow"><span>Stock</span><input name="stock" type="number" min={0} defaultValue={p?.stock ?? ""} placeholder="empty = unlimited" /></label>
            </div>
            <div className="row">
              <label className="field narrow"><span>Colour</span><input name="color" type="color" defaultValue={p?.color ?? "#55e03a"} /></label>
              <label className="field narrow"><span>Sort order</span><input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} /></label>
            </div>
            <label className="check"><input type="checkbox" name="active" defaultChecked={p ? p.active : true} /><span><b>Active</b><small>Shown in the store and can be bought. Untick to hide or archive.</small></span></label>
            <label className="check"><input type="checkbox" name="featured" defaultChecked={!!p?.featured} /><span><b>Featured</b><small>Highlighted as &quot;Popular&quot;.</small></span></label>
          </fieldset>

          <fieldset className="card">
            <legend>What the buyer receives</legend>
            <div className="row">
              <label className="field">
                <span>Rank (LuckPerms group)</span>
                <select name="rankKey" defaultValue={p?.grants?.rankKey ?? ""}>
                  <option value="">— none —</option>
                  {p?.grants?.rankKey && !rankKeys.has(p.grants.rankKey) && <option value={p.grants.rankKey}>{p.grants.rankKey} (missing)</option>}
                  {ranks.map((r) => <option key={r.key} value={r.key}>{r.displayName} ({r.key})</option>)}
                </select>
              </label>
              <label className="field">
                <span>Chat tag</span>
                <select name="tagKey" defaultValue={p?.grants?.tagKey ?? ""}>
                  <option value="">— none —</option>
                  {p?.grants?.tagKey && !tagKeys.has(p.grants.tagKey) && <option value={p.grants.tagKey}>{p.grants.tagKey} (missing)</option>}
                  {tags.map((t) => <option key={t.key} value={t.key}>{t.display} ({t.key})</option>)}
                </select>
              </label>
              <label className="field">
                <span>Discord role ID</span>
                <input name="discordRoleId" inputMode="numeric" defaultValue={p?.grants?.discordRoleId ?? ""} placeholder="optional" />
              </label>
            </div>
            <label className="field">
              <span>Console commands (one per line)</span>
              <textarea name="commands" defaultValue={(p?.grants?.commands ?? []).join("\n")} rows={4} placeholder={"crate key give {player} vote 1\nlp user {uuid} permission set essentials.fly true"} spellCheck={false} />
              <small>Use {"{player}"} and {"{uuid}"}. No leading slash needed. Semicolons and line breaks are refused. Runs once per unit bought, and is not undone on refund.</small>
            </label>
            {!ranks.length && <p className="st-note">No ranks exist yet. Create them under Ranks &amp; Tags to pick one here.</p>}
          </fieldset>

          <div className="st-actions">
            <button className="btn primary" type="submit">Save product</button>
            <Link className="btn ghost" href={storeHref({ tab: "products" })}>Cancel</Link>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        {products.length ? (
          <table>
            <thead><tr><th>Product</th><th>Type</th><th className="st-num">Price</th><th>Duration</th><th>Stock</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {products.map((x) => (
                <tr key={String(x._id)}>
                  <td><i className="st-swatch" style={{ background: x.color }} />{x.name}<br /><small>{x.slug}</small></td>
                  <td>{x.type}</td>
                  <td className="st-num">{formatMoney(x.price.inr, "INR")}<br /><small>{formatMoney(x.price.usd, "USD")}</small></td>
                  <td>{x.durationDays ? `${x.durationDays} days` : "Permanent"}</td>
                  <td>{typeof x.stock === "number" ? x.stock : "∞"}</td>
                  <td>
                    <span className={`st-chip ${x.active ? "s-active" : "s-archived"}`}>{x.active ? "active" : "archived"}</span>{" "}
                    {x.featured && <span className="st-chip s-featured">featured</span>}
                  </td>
                  <td>
                    <div className="st-actions">
                      <Link className="btn ghost sm" href={storeHref({ tab: "products", edit: String(x._id) })}>Edit</Link>
                      <form action={deleteProduct}>
                        <input type="hidden" name="id" value={String(x._id)} />
                        <button className="btn ghost sm" title={used.has(x.slug) ? "Has orders: will be archived, not deleted" : "Delete this product"}>{used.has(x.slug) ? "Archive" : "Delete"}</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="st-empty">No products yet. Create one, or seed them from the rank cards on the website.</p>
        )}
      </div>
    </>
  );
}
