import Link from "next/link";
import { connectDB } from "@/server/db";
import { Appeal, Punishment } from "@/server/models/Punishment";
import { requireRole } from "@/server/guard";
import { hasRole } from "@/server/roles";
import { ACTIVE_TYPES, MAX_REASON, PAGE_SIZE, isBanType, parsePage, showIp } from "@/server/players-util";
import { expireStale } from "../players/punish-core";
import { reviewAppeal, revokeAction } from "./actions";
import { Avatar, Pager, PunishStatus, fmtDate } from "../players/ui";
import "../players.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bans & Mutes — Admin" };

const TABS = ["active", "history", "appeals"] as const;
type Tab = (typeof TABS)[number];
const SAVED: Record<string, string> = {
  revoked: "Punishment lifted and the server was told.",
  accepted: "Appeal accepted and the punishment was lifted.",
  denied: "Appeal denied.",
};

export default async function BansPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string; saved?: string; error?: string }> }) {
  const me = await requireRole("viewer");
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "active";
  const isMod = hasRole(me.role, "mod");

  await connectDB();
  await expireStale();

  const activeFilter = { active: true, type: { $in: [...ACTIVE_TYPES] } };
  const [activeCount, historyCount, openAppeals] = await Promise.all([
    Punishment.countDocuments(activeFilter),
    Punishment.countDocuments({}),
    Appeal.countDocuments({ status: "open" }),
  ]);
  const counts: Record<Tab, number> = { active: activeCount, history: historyCount, appeals: openAppeals };
  const labels: Record<Tab, string> = { active: "Active", history: "History", appeals: "Appeals" };

  const list = tab === "active" || tab === "history";
  const total = tab === "active" ? activeCount : historyCount;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = parsePage(sp.page, pages);
  const rows = list
    ? await Punishment.find(tab === "active" ? activeFilter : {})
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean()
    : [];

  const open = tab === "appeals" ? await Appeal.find({ status: "open" }).sort({ createdAt: 1 }).limit(100).lean() : [];
  const reviewed = tab === "appeals" ? await Appeal.find({ status: { $ne: "open" } }).sort({ reviewedAt: -1 }).limit(15).lean() : [];
  const punById = new Map<string, (typeof rows)[number]>();
  if (tab === "appeals") {
    const ids = [...open, ...reviewed].map((a) => a.punishmentId);
    for (const p of await Punishment.find({ _id: { $in: ids } }).lean()) punById.set(String(p._id), p);
  }

  return (
    <>
      <h1 className="admin-h">Bans &amp; Mutes</h1>
      {sp.saved && <p className="notice ok" role="status">{SAVED[sp.saved] || "Saved."}</p>}
      {sp.error && <p className="notice err" role="alert">{sp.error}</p>}

      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <Link key={t} href={`/admin/bans?tab=${t}`} className={t === tab ? "active" : undefined} aria-current={t === tab ? "page" : undefined}>
            {labels[t]} <em>{counts[t]}</em>
          </Link>
        ))}
      </nav>

      {list && (
        <>
          <div className="card table-wrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Player</th><th>Type</th><th>Reason</th><th>By</th><th>Issued</th><th>Expires</th>
                  {tab === "history" && <th>Status</th>}
                  {tab === "active" && isMod && <th>Lift</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={String(p._id)}>
                    <td>
                      <span className="pl-name">
                        <Avatar name={p.playerName} />
                        <Link href={`/admin/players/${encodeURIComponent(p.playerUuid)}`}>{p.playerName}</Link>
                      </span>
                    </td>
                    <td>
                      <span className="chip warn">{p.type}</span>
                      {p.type === "ipban" && <><br /><small className="muted">{showIp(p.ip, me.role)}</small></>}
                    </td>
                    <td className="wrap">
                      {p.reason}
                      {tab === "history" && p.revokedBy && p.revokedBy !== "System" && <><br /><small className="muted">Revoked by {p.revokedBy}: {p.revokeReason}</small></>}
                    </td>
                    <td>{p.issuedBy}{p.source !== "web" && <> <span className="chip">{p.source}</span></>}</td>
                    <td>{fmtDate(p.createdAt)}</td>
                    <td>{p.expiresAt ? fmtDate(p.expiresAt) : p.type === "kick" || p.type === "warn" ? "—" : "never"}</td>
                    {tab === "history" && <td><PunishStatus p={p} /></td>}
                    {tab === "active" && isMod && (
                      <td>
                        <form action={revokeAction} className="revoke-form">
                          <input type="hidden" name="id" value={String(p._id)} />
                          <input type="hidden" name="tab" value="active" />
                          <input name="reason" placeholder="Reason (required)" required minLength={3} maxLength={MAX_REASON} aria-label={`Reason for lifting ${p.playerName}`} />
                          <button className="btn ghost sm" type="submit">{isBanType(p.type) ? "Unban" : "Unmute"}</button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} className="muted">{tab === "active" ? "Nobody is banned or muted right now." : "No punishments recorded yet."}</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager base="/admin/bans" params={{ tab: tab === "active" ? undefined : tab }} page={page} pages={pages} total={total} />
        </>
      )}

      {tab === "appeals" && (
        <>
          <div className="ap-list">
            {open.map((a) => {
              const p = punById.get(String(a.punishmentId));
              return (
                <article className="card ap-card" key={String(a._id)}>
                  <header>
                    <span className="pl-name"><Avatar name={a.playerName} /><b>{a.playerName}</b></span>
                    <small className="muted">Submitted {fmtDate(a.createdAt)}</small>
                  </header>
                  {p ? (
                    <p className="muted small">
                      <span className="chip warn">{p.type}</span> {p.reason} · by {p.issuedBy} · {fmtDate(p.createdAt)}
                      {!p.active && <> · <PunishStatus p={p} /></>}
                    </p>
                  ) : (
                    <p className="muted small">The original punishment no longer exists.</p>
                  )}
                  <div className="ap-msg">{a.message}</div>
                  {isMod ? (
                    <form action={reviewAppeal} className="ap-actions">
                      <input type="hidden" name="id" value={String(a._id)} />
                      <label className="field">
                        <span>Note (required to deny, optional to accept)</span>
                        <textarea name="note" maxLength={500} />
                      </label>
                      <div className="btns">
                        <button className="btn primary sm" name="decision" value="accept" type="submit">Accept &amp; lift punishment</button>
                        <button className="btn danger sm" name="decision" value="deny" type="submit">Deny</button>
                      </div>
                    </form>
                  ) : (
                    <p className="muted small">You need the mod role to review appeals.</p>
                  )}
                </article>
              );
            })}
            {open.length === 0 && <div className="card"><p>No open appeals.</p></div>}
          </div>

          {reviewed.length > 0 && (
            <section className="pd-section">
              <h2>Recently reviewed</h2>
              <div className="card table-wrap">
                <table className="pl-table">
                  <thead><tr><th>Player</th><th>Result</th><th>Reviewed by</th><th>Note</th><th>When</th></tr></thead>
                  <tbody>
                    {reviewed.map((a) => (
                      <tr key={String(a._id)}>
                        <td>{a.playerName}</td>
                        <td><span className={`chip ${a.status === "accepted" ? "on" : "bad"}`}>{a.status}</span></td>
                        <td>{a.reviewedBy}</td>
                        <td className="wrap">{a.reviewNote || "—"}</td>
                        <td>{fmtDate(a.reviewedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
