import Link from "next/link";
import { requireRole } from "@/server/guard";
import { getSectionForAdmin } from "@/server/content";
import { SECTIONS, isSectionKey, sectionDef, type FieldDef, type Item, type SectionDef } from "@/server/content-schema";
import { saveItem, deleteItem, moveItem, resetSection } from "./actions";
import "./content.css";

export const metadata = { title: "Site content — Admin" };
export const dynamic = "force-dynamic";

type SP = { tab?: string; edit?: string; saved?: string; error?: string };

const SAVED: Record<string, string> = {
  "1": "Saved. The public page is updated.",
  deleted: "Deleted. The public page is updated.",
  moved: "Order changed.",
  reset: "Reset. The public page shows the built-in default again.",
};

export default async function ContentPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const def = sectionDef(sp.tab) ?? SECTIONS[0];
  const key = def.key;

  // Counts for every tab, and the full list for the open one.
  const all = await Promise.all(SECTIONS.map(async (s) => [s.key, await getSectionForAdmin(s.key)] as const));
  const byKey = new Map(all);
  const { items, custom } = byKey.get(key)!;

  const editParam = sp.edit;
  const adding = editParam === "new";
  const editIndex = editParam && !adding && /^\d{1,4}$/.test(editParam) && Number(editParam) < items.length ? Number(editParam) : null;
  const formOpen = adding || editIndex !== null;
  const full = items.length >= def.max;

  return (
    <>
      <h1 className="admin-h">Site content</h1>
      <p className="muted ct-lead">Everything players read on the public website. Change it here, no code needed. Saved changes show on the site within seconds.</p>

      <nav className="ct-tabs" aria-label="Content sections">
        {SECTIONS.map((s) => (
          <Link key={s.key} href={`/admin/content?tab=${s.key}`} className={s.key === key ? "active" : ""} aria-current={s.key === key ? "page" : undefined}>
            <span aria-hidden>{s.icon}</span>
            <b>{s.label}</b>
            <em>{byKey.get(s.key)!.items.length}</em>
          </Link>
        ))}
      </nav>

      {sp.saved && <p className="notice ok" role="status">{SAVED[sp.saved] ?? "Saved."}</p>}
      {sp.error && <p className="notice err" role="alert">{sp.error}</p>}

      <section className="card ct-head">
        <div className="ct-head-main">
          <span className="ct-ico" aria-hidden>{def.icon}</span>
          <div>
            <h2>{def.label}</h2>
            <p className="muted">{def.blurb}</p>
            <p className="ct-meta">
              <span className={`chip ${custom ? "on" : ""}`}>{custom ? "Customised" : "Built-in default"}</span>
              <span className="muted small">Shown on {def.pages.map((p, i) => (
                <span key={p}>{i > 0 && ", "}<a href={p} target="_blank" rel="noopener noreferrer">{p === "/" ? "Home" : p}</a></span>
              ))}</span>
              <span className="muted small">{items.length} / {def.max}</span>
            </p>
          </div>
        </div>
        {full ? (
          <span className="btn ghost sm is-disabled" aria-disabled="true">List is full</span>
        ) : (
          <Link className="btn primary" href={`/admin/content?tab=${key}&edit=new`}>＋ Add {def.label === "Vote sites" ? "site" : "item"}</Link>
        )}
      </section>

      {formOpen && <ItemForm def={def} item={editIndex !== null ? items[editIndex] : undefined} index={editIndex} />}

      {items.length === 0 ? (
        <div className="card ct-empty">
          <b>Nothing here yet</b>
          <span className="muted">{emptyNote(key)}</span>
          {!full && <Link className="btn primary sm" href={`/admin/content?tab=${key}&edit=new`}>Add the first one</Link>}
        </div>
      ) : (
        <ol className="ct-list">
          {items.map((it, i) => (
            <li key={i} className={`card ct-item${editIndex === i ? " editing" : ""}`}>
              <span className="ct-pos">{i + 1}</span>
              <Preview def={def} item={it} />
              <div className="ct-text">
                <b>{it[def.title]}</b>
                {def.sub && it[def.sub] && <span className="muted">{it[def.sub]}</span>}
              </div>
              <div className="ct-actions">
                <form action={moveItem}>
                  <input type="hidden" name="section" value={key} /><input type="hidden" name="index" value={i} /><input type="hidden" name="dir" value="up" />
                  <button className="btn ghost sm" disabled={i === 0} aria-label="Move up" title="Move up">↑</button>
                </form>
                <form action={moveItem}>
                  <input type="hidden" name="section" value={key} /><input type="hidden" name="index" value={i} /><input type="hidden" name="dir" value="down" />
                  <button className="btn ghost sm" disabled={i === items.length - 1} aria-label="Move down" title="Move down">↓</button>
                </form>
                <Link className="btn ghost sm" href={`/admin/content?tab=${key}&edit=${i}`}>Edit</Link>
                <form action={deleteItem}>
                  <input type="hidden" name="section" value={key} /><input type="hidden" name="index" value={i} />
                  <button className="btn ghost sm ct-danger">Delete</button>
                </form>
              </div>
            </li>
          ))}
        </ol>
      )}

      {custom && (
        <details className="card ct-reset">
          <summary>Reset {def.label} to the built-in default</summary>
          <form action={resetSection}>
            <input type="hidden" name="section" value={key} />
            <p className="muted">This throws away your {items.length} saved item(s) and shows the original content on the website again.</p>
            <label className="check"><input type="checkbox" name="sure" /><span><b>Yes, reset it</b></span></label>
            <button className="btn danger sm" type="submit">Reset {def.label}</button>
          </form>
        </details>
      )}
    </>
  );
}

function emptyNote(key: string): string {
  if (key === "team") return "The Team page shows a friendly 'coming soon' message until you add staff.";
  if (key === "vote") return "The Vote page says voting is not open yet until you add a site.";
  if (key === "gallery") return "The Gallery page shows placeholder tiles until you add screenshots.";
  return "The public page hides this block until you add something.";
}

function Preview({ def, item }: { def: SectionDef; item: Item }) {
  if (def.key === "team") {
    return (
      <span className="ct-thumb" style={{ ["--c" as string]: item.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://mc-heads.net/avatar/${encodeURIComponent(item.name)}/64`} alt="" width={44} height={44} loading="lazy" />
      </span>
    );
  }
  if (def.key === "gallery") {
    return (
      <span className="ct-thumb wide">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.src} alt="" width={72} height={44} loading="lazy" />
      </span>
    );
  }
  return null;
}

function Field({ f, value }: { f: FieldDef; value: string }) {
  const common = { name: f.name, required: f.required, maxLength: f.max, placeholder: f.placeholder, defaultValue: value } as const;
  return (
    <label className={`field${f.kind === "textarea" ? " ct-wide" : ""}`}>
      <span>{f.label}{f.required && <i aria-hidden> *</i>}</span>
      {f.kind === "textarea" ? (
        <textarea {...common} rows={3} />
      ) : f.kind === "color" ? (
        <input name={f.name} type="color" defaultValue={/^#[0-9a-f]{6}$/i.test(value) ? value : "#55ffff"} className="ct-color" />
      ) : (
        <input {...common} type={f.kind === "url" ? "url" : "text"} />
      )}
      {f.help && <small className="muted">{f.help}</small>}
    </label>
  );
}

function ItemForm({ def, item, index }: { def: SectionDef; item?: Item; index: number | null }) {
  return (
    <form action={saveItem} className="card ct-form">
      <h3>{index === null ? `Add to ${def.label}` : `Edit item ${index + 1}`}</h3>
      <input type="hidden" name="section" value={def.key} />
      {index !== null && <input type="hidden" name="index" value={index} />}
      <div className="ct-grid">
        {def.fields.map((f) => <Field key={f.name} f={f} value={item?.[f.name] ?? ""} />)}
      </div>
      <div className="ct-form-actions">
        <button className="btn primary" type="submit">{index === null ? "Add" : "Save changes"}</button>
        <Link className="btn ghost" href={`/admin/content?tab=${def.key}`}>Cancel</Link>
      </div>
    </form>
  );
}
