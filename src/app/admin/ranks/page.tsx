import Link from "next/link";
import { connectDB } from "@/server/db";
import { Rank, Tag } from "@/server/models/Rank";
import { Player } from "@/server/models/Player";
import { requireRole } from "@/server/guard";
import { hasRole } from "@/server/roles";
import { escapeRegex } from "@/server/ranks-util";
import McText from "./McText";
import LookFields from "./LookFields";
import { saveRank, deleteRank, seedRanks, saveTag, deleteTag, assignRank, removeRank, setPlayerTag } from "./actions";
import "../ranks.css";

export const metadata = { title: "Ranks & Tags — Admin" };

type SP = { tab?: string; edit?: string; q?: string; uuid?: string; saved?: string; error?: string };
type Tab = "ranks" | "tags" | "assign";

export default async function RanksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireRole("mod");
  const canEdit = hasRole(me.role, "admin");
  const sp = await searchParams;
  const tab: Tab = sp.tab === "tags" ? "tags" : sp.tab === "assign" && canEdit ? "assign" : "ranks";
  await connectDB();

  const tabs: { id: Tab; label: string }[] = [
    { id: "ranks", label: "Ranks" },
    { id: "tags", label: "Tags" },
    ...(canEdit ? [{ id: "assign" as Tab, label: "Assign" }] : []),
  ];

  return (
    <>
      <h1 className="admin-h">Ranks &amp; Tags</h1>
      <nav className="rk-tabs" aria-label="Ranks and tags sections">
        {tabs.map((t) => (
          <Link key={t.id} href={`/admin/ranks?tab=${t.id}`} className={t.id === tab ? "active" : ""} aria-current={t.id === tab ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      {sp.saved && <p className="notice ok" role="status">Saved. Changes reach the server when the plugin next checks in.</p>}
      {sp.error && <p className="notice err" role="alert">{sp.error}</p>}
      {!canEdit && <p className="muted rk-gap">You can view ranks and tags. Editing needs the admin role.</p>}

      {tab === "ranks" && <RanksTab canEdit={canEdit} edit={sp.edit} />}
      {tab === "tags" && <TagsTab canEdit={canEdit} edit={sp.edit} />}
      {tab === "assign" && <AssignTab q={sp.q} uuid={sp.uuid} />}
    </>
  );
}

// ---------------------------------------------------------------- ranks
async function RanksTab({ canEdit, edit }: { canEdit: boolean; edit?: string }) {
  const ranks = await Rank.find().sort({ weight: -1, key: 1 }).lean();
  const editing = edit ? ranks.find((r) => r.key === edit) : undefined;
  const counts = await Player.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$rankKey", n: { $sum: 1 } } }]);
  const byRank = new Map(counts.map((c) => [c._id, c.n]));

  return (
    <>
      {ranks.length === 0 ? (
        <div className="card">
          <h3>No ranks yet</h3>
          <p>Ranks mirror LuckPerms groups. Create them below{canEdit ? ", or start from a standard set." : "."}</p>
          {canEdit && (
            <form action={seedRanks} style={{ marginTop: 14 }}>
              <button className="btn gold sm">Seed default ranks</button>
              <p className="muted small" style={{ marginTop: 8 }}>Creates Default, Iron, Gold, Diamond, Helper, Mod, Admin and Owner and queues them for the server.</p>
            </form>
          )}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="rk-table">
            <thead><tr><th>Rank</th><th>Weight</th><th>Inherits</th><th>Players</th><th>Sync</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {ranks.map((r) => (
                <tr key={r.key}>
                  <td>
                    <McText text={r.prefix ?? ""} />
                    <b style={{ color: r.color }}>{r.displayName}</b>
                    <br />
                    <small className="muted">{r.key}</small>
                    {r.isDefault && <span className="rk-flag def">default</span>}
                    {r.isStaff && <span className="rk-flag staff">staff</span>}
                  </td>
                  <td data-label="Weight">{r.weight}</td>
                  <td data-label="Inherits">{r.inherits?.length ? r.inherits.join(", ") : "—"}</td>
                  <td data-label="Players">{byRank.get(r.key) ?? 0}</td>
                  <td data-label="Sync">{r.syncedAt ? "synced" : "pending"}</td>
                  {canEdit && (
                    <td className="rk-actions">
                      <Link className="btn ghost sm" href={`/admin/ranks?tab=ranks&edit=${r.key}#rank-form`}>Edit</Link>
                      <form action={deleteRank}>
                        <input type="hidden" name="key" value={r.key} />
                        <button className="btn ghost sm rk-danger" aria-label={`Delete rank ${r.displayName}`}>Delete</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <form action={saveRank} id="rank-form" className="settings rk-form" key={editing?.key ?? "new"}>
          <fieldset className="card">
            <legend>{editing ? `Edit rank: ${editing.key}` : "Create rank"}</legend>
            {editing && <input type="hidden" name="originalKey" value={editing.key} />}
            <label className="field">
              <span>Key (LuckPerms group name: a-z, 0-9, _)</span>
              <input name="key" defaultValue={editing?.key ?? ""} required maxLength={32} pattern="[a-z0-9_]{1,32}" readOnly={!!editing} autoCapitalize="none" />
            </label>
            <LookFields
              displayName={editing?.displayName ?? ""}
              color={editing?.color ?? "#ffffff"}
              prefix={editing?.prefix ?? ""}
              suffix={editing?.suffix ?? ""}
            />
            <div className="row">
              <label className="field narrow"><span>Weight</span><input name="weight" type="number" step={1} min={-1000} max={100000} defaultValue={editing?.weight ?? 0} required /></label>
              <label className="field"><span>Discord role id (optional)</span><input name="discordRoleId" inputMode="numeric" defaultValue={editing?.discordRoleId ?? ""} maxLength={20} pattern="\d{17,20}" /></label>
            </div>
            <div className="field">
              <span>Inherits</span>
              {ranks.filter((r) => r.key !== editing?.key).length === 0 ? (
                <small className="muted">No other ranks to inherit from yet.</small>
              ) : (
                <div className="rk-checks">
                  {ranks.filter((r) => r.key !== editing?.key).map((r) => (
                    <label key={r.key} className="rk-chip">
                      <input type="checkbox" name="inherits" value={r.key} defaultChecked={editing?.inherits?.includes(r.key)} />
                      <span style={{ color: r.color }}>{r.displayName}</span>
                    </label>
                  ))}
                </div>
              )}
              <small className="muted">Cycles are rejected on save.</small>
            </div>
            <label className="check"><input type="checkbox" name="isStaff" defaultChecked={editing?.isStaff} /><span><b>Staff rank</b><small>Shown as staff on the website team page.</small></span></label>
            <label className="check"><input type="checkbox" name="isDefault" defaultChecked={editing?.isDefault} /><span><b>Default rank</b><small>Given to every new player. Only one rank can be default; this replaces the current one.</small></span></label>
            <label className="field">
              <span>Permissions (one node per line, leading - negates)</span>
              <textarea name="permissions" rows={8} spellCheck={false} defaultValue={(editing?.permissions ?? []).join("\n")} placeholder={"essentials.home\n-essentials.fly\nworldedit.*"} />
            </label>
          </fieldset>
          <div className="rk-buttons">
            <button className="btn primary" type="submit">{editing ? "Save rank" : "Create rank"}</button>
            {editing && <Link className="btn ghost" href="/admin/ranks?tab=ranks">Cancel</Link>}
          </div>
        </form>
      )}
    </>
  );
}

// ---------------------------------------------------------------- tags
async function TagsTab({ canEdit, edit }: { canEdit: boolean; edit?: string }) {
  const tags = await Tag.find().sort({ key: 1 }).lean();
  const editing = edit ? tags.find((t) => t.key === edit) : undefined;
  return (
    <>
      <div className="card table-wrap">
        <table className="rk-table">
          <thead><tr><th>Tag</th><th>Description</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {tags.length === 0 && <tr><td colSpan={canEdit ? 4 : 3} className="muted">No tags yet.</td></tr>}
            {tags.map((t) => (
              <tr key={t.key}>
                <td><McText text={t.display} fallback={t.color} /><br /><small className="muted">{t.key}</small></td>
                <td data-label="Description">{t.description || "—"}</td>
                <td data-label="Status">{t.active ? "active" : "inactive"}</td>
                {canEdit && (
                  <td className="rk-actions">
                    <Link className="btn ghost sm" href={`/admin/ranks?tab=tags&edit=${t.key}#tag-form`}>Edit</Link>
                    <form action={deleteTag}>
                      <input type="hidden" name="key" value={t.key} />
                      <button className="btn ghost sm rk-danger" aria-label={`Delete tag ${t.key}`}>Delete</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <form action={saveTag} id="tag-form" className="settings rk-form" key={editing?.key ?? "new"}>
          <fieldset className="card">
            <legend>{editing ? `Edit tag: ${editing.key}` : "Create tag"}</legend>
            {editing && <input type="hidden" name="originalKey" value={editing.key} />}
            <div className="row">
              <label className="field"><span>Key (a-z, 0-9, _)</span><input name="key" defaultValue={editing?.key ?? ""} required maxLength={32} pattern="[a-z0-9_]{1,32}" readOnly={!!editing} autoCapitalize="none" /></label>
              <label className="field"><span>Display</span><input name="display" defaultValue={editing?.display ?? ""} required maxLength={32} placeholder="[Legend]" /></label>
              <label className="field narrow"><span>Colour</span><input name="color" defaultValue={editing?.color ?? "#ffd54a"} required maxLength={7} pattern="#[0-9a-fA-F]{6}" /></label>
            </div>
            <label className="field"><span>Description</span><input name="description" defaultValue={editing?.description ?? ""} maxLength={200} /></label>
            <label className="check"><input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} /><span><b>Active</b><small>Inactive tags cannot be assigned or bought.</small></span></label>
          </fieldset>
          <div className="rk-buttons">
            <button className="btn primary" type="submit">{editing ? "Save tag" : "Create tag"}</button>
            {editing && <Link className="btn ghost" href="/admin/ranks?tab=tags">Cancel</Link>}
          </div>
        </form>
      )}
    </>
  );
}

// ---------------------------------------------------------------- assign
async function AssignTab({ q, uuid }: { q?: string; uuid?: string }) {
  const query = (q ?? "").trim().slice(0, 16);
  const [ranks, tags] = await Promise.all([Rank.find().sort({ weight: -1 }).lean(), Tag.find({ active: true }).sort({ key: 1 }).lean()]);
  const results = query
    ? await Player.find({ name: { $regex: escapeRegex(query), $options: "i" } }).sort({ online: -1, name: 1 }).limit(20).lean()
    : [];
  const selected = uuid ? results.find((p) => p.uuid === uuid) ?? (await Player.findOne({ uuid }).lean()) : undefined;
  const rankName = (k?: string | null) => ranks.find((r) => r.key === k);

  return (
    <>
      <form method="get" action="/admin/ranks" className="rk-search card">
        <input type="hidden" name="tab" value="assign" />
        <label className="field"><span>Find a player by name</span><input name="q" defaultValue={query} placeholder="Steve" maxLength={16} autoComplete="off" /></label>
        <button className="btn primary sm">Search</button>
      </form>

      {query && results.length === 0 && <p className="muted">No players match &quot;{query}&quot;. Players appear after they join once.</p>}

      {results.length > 0 && (
        <div className="card rk-results">
          {results.map((p) => (
            <Link key={p.uuid} className={p.uuid === selected?.uuid ? "active" : ""} href={`/admin/ranks?tab=assign&q=${encodeURIComponent(query)}&uuid=${p.uuid}`}>
              <b>{p.name}</b>
              <small className="muted">{p.online ? "online" : "offline"} · {rankName(p.rankKey)?.displayName ?? p.rankKey ?? "default"}</small>
            </Link>
          ))}
        </div>
      )}

      {selected && (
        <div className="card rk-assign">
          <h3>{selected.name}</h3>
          <p className="muted small">
            Rank: <b>{rankName(selected.rankKey)?.displayName ?? selected.rankKey ?? "default"}</b> · Tag: <b>{selected.tagKey ?? "none"}</b> · {selected.uuid}
          </p>

          <form action={assignRank} className="rk-inline">
            <input type="hidden" name="uuid" value={selected.uuid} />
            <input type="hidden" name="q" value={query} />
            <label className="field"><span>Set rank</span>
              <select name="rankKey" defaultValue={selected.rankKey ?? ""} required>
                <option value="" disabled>Choose…</option>
                {ranks.map((r) => <option key={r.key} value={r.key}>{r.displayName} ({r.key})</option>)}
              </select>
            </label>
            <label className="field"><span>Duration</span>
              <select name="expiry" defaultValue="none"><option value="none">Permanent</option><option value="days">For N days</option></select>
            </label>
            <label className="field narrow"><span>Days</span><input name="days" type="number" min={1} max={3650} placeholder="30" /></label>
            <button className="btn primary sm">Assign</button>
          </form>

          <form action={removeRank} className="rk-inline">
            <input type="hidden" name="uuid" value={selected.uuid} />
            <input type="hidden" name="q" value={query} />
            <p className="muted small">Remove their current rank and fall back to the default.</p>
            <button className="btn ghost sm rk-danger">Remove rank</button>
          </form>

          <form action={setPlayerTag} className="rk-inline">
            <input type="hidden" name="uuid" value={selected.uuid} />
            <input type="hidden" name="q" value={query} />
            <label className="field"><span>Chat tag</span>
              <select name="tagKey" defaultValue={selected.tagKey ?? ""}>
                <option value="">No tag (clear)</option>
                {tags.map((t) => <option key={t.key} value={t.key}>{t.display} ({t.key})</option>)}
              </select>
            </label>
            <button className="btn primary sm">Save tag</button>
          </form>
        </div>
      )}
    </>
  );
}
