import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDB } from "@/server/db";
import { Player } from "@/server/models/Player";
import { Punishment } from "@/server/models/Punishment";
import { requireRole } from "@/server/guard";
import { hasRole } from "@/server/roles";
import { MAX_NOTE, MAX_REASON, canActOn, formatMinutes, isBanType, isValidUuid, showIp } from "@/server/players-util";
import { defaultReason, expireStale, highestLinkedRole } from "../punish-core";
import { addNote, punishPlayer, setWhitelist } from "../actions";
import { Avatar, PunishStatus, fmtDate } from "../ui";
import "../../players.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Player — Admin" };

const SAVED: Record<string, string> = {
  punished: "Punishment applied and sent to the server.",
  note: "Note added.",
  whitelisted: "Whitelist add queued.",
  unwhitelisted: "Whitelist removal queued.",
};

const TYPES: { v: string; label: string }[] = [
  { v: "warn", label: "Warn" },
  { v: "kick", label: "Kick" },
  { v: "mute", label: "Mute (permanent)" },
  { v: "tempmute", label: "Temp mute" },
  { v: "tempban", label: "Temp ban" },
  { v: "ban", label: "Ban (permanent)" },
  { v: "ipban", label: "IP ban" },
];

export default async function PlayerPage({ params, searchParams }: { params: Promise<{ uuid: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const me = await requireRole("viewer");
  const { uuid } = await params;
  const { saved, error } = await searchParams;
  if (!isValidUuid(uuid)) notFound();

  await connectDB();
  await expireStale();
  const player = await Player.findOne({ uuid }).lean();
  if (!player) notFound();

  const history = await Punishment.find({ playerUuid: uuid }).sort({ createdAt: -1 }).limit(100).lean();
  const targetRole = await highestLinkedRole(player);
  const isMod = hasRole(me.role, "mod");
  const allowed = canActOn(me.role, targetRole);
  const reason = await defaultReason();
  const activeBan = history.some((h) => h.active && isBanType(h.type));
  const activeMute = history.some((h) => h.active && (h.type === "mute" || h.type === "tempmute"));
  const notes = [...(player.notes ?? [])].reverse();

  return (
    <>
      <p style={{ marginBottom: 12 }}><Link className="muted back" href="/admin/players">← All players</Link></p>
      <div className="pd-head">
        <Avatar name={player.name} size={64} />
        <div>
          <h1>{player.name}</h1>
          <div className="sub">
            <span className="chip">{player.edition}</span>
            {player.online ? <span className="chip on">online</span> : <span className="chip">offline</span>}
            {player.whitelisted && <span className="chip on">whitelisted</span>}
            {activeBan && <span className="chip bad">banned</span>}
            {activeMute && <span className="chip warn">muted</span>}
            {targetRole && targetRole !== "user" && <span className={`role-chip r-${targetRole}`}>staff: {targetRole}</span>}
          </div>
        </div>
      </div>

      {saved && <p className="notice ok" role="status">{SAVED[saved] || "Saved."}</p>}
      {error && <p className="notice err" role="alert">{error}</p>}

      <div className="kpis">
        <div className="kpi"><span>Playtime</span><b>{formatMinutes(player.playtimeMinutes)}</b></div>
        <div className="kpi"><span>Kills / deaths</span><b>{player.kills} / {player.deaths}</b></div>
        <div className="kpi"><span>Balance</span><b>{Number(player.balance ?? 0).toLocaleString("en-IN")}</b></div>
        <div className="kpi"><span>Rank</span><b style={{ fontSize: 24 }}>{player.rankKey || "default"}</b></div>
      </div>

      <div className="pd-grid">
        <section className="card pd-card">
          <h2>Details</h2>
          <dl className="pd-facts">
            <dt>UUID</dt><dd>{player.uuid}</dd>
            <dt>Tag</dt><dd>{player.tagKey || "none"}</dd>
            <dt>First seen</dt><dd>{fmtDate(player.firstSeen)}</dd>
            <dt>Last seen</dt><dd>{player.online ? "Online now" : fmtDate(player.lastSeen)}</dd>
            <dt>Last IP</dt><dd>{showIp(player.lastIp, me.role)}</dd>
          </dl>
          {isMod && (
            <form action={setWhitelist}>
              <input type="hidden" name="uuid" value={player.uuid} />
              <input type="hidden" name="on" value={player.whitelisted ? "0" : "1"} />
              <button className="btn ghost sm" type="submit">{player.whitelisted ? "Remove from whitelist" : "Add to whitelist"}</button>
            </form>
          )}
        </section>

        <section className="card pd-card">
          <h2>Punish</h2>
          {!isMod ? (
            <p className="muted">You need the mod role to punish players.</p>
          ) : !allowed ? (
            <p className="notice err" style={{ margin: 0 }}>This player is linked to a staff account ({targetRole}) at or above your role, so you cannot punish them.</p>
          ) : (
            <form action={punishPlayer} className="pd-form">
              <input type="hidden" name="uuid" value={player.uuid} />
              <label className="field">
                <span>Type</span>
                <select name="type" defaultValue="warn" required>
                  {TYPES.map((t) => (
                    <option key={t.v} value={t.v} disabled={t.v === "ipban" && !player.lastIp}>
                      {t.label}{t.v === "ipban" && !player.lastIp ? " (no IP known)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span>Duration (only for temp ban / temp mute)</span>
                <div className="dur">
                  <input name="amount" type="number" inputMode="numeric" min={1} max={999999} placeholder="e.g. 7" aria-label="Duration amount" />
                  <select name="unit" defaultValue="days" aria-label="Duration unit">
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </div>
              </div>
              <label className="field">
                <span>Reason (required)</span>
                <input name="reason" defaultValue={reason} required minLength={3} maxLength={MAX_REASON} />
              </label>
              <button className="btn danger" type="submit">Apply punishment</button>
            </form>
          )}
        </section>
      </div>

      <section className="pd-section">
        <h2>Punishment history</h2>
        <div className="card table-wrap">
          <table className="pl-table">
            <thead><tr><th>Type</th><th>Reason</th><th>By</th><th>Issued</th><th>Expires</th><th>Status</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={String(h._id)}>
                  <td><span className="chip warn">{h.type}</span>{h.source !== "web" && <> <span className="chip">{h.source}</span></>}</td>
                  <td className="wrap">{h.reason}{h.revokedBy && h.revokedBy !== "System" ? <><br /><small className="muted">Revoked by {h.revokedBy}: {h.revokeReason}</small></> : null}</td>
                  <td>{h.issuedBy}</td>
                  <td>{fmtDate(h.createdAt)}</td>
                  <td>{h.expiresAt ? fmtDate(h.expiresAt) : isBanType(h.type) || h.type.endsWith("mute") ? "never" : "—"}</td>
                  <td><PunishStatus p={h} /></td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={6} className="muted">Clean record.</td></tr>}
            </tbody>
          </table>
        </div>
        {isMod && (activeBan || activeMute) && <p className="muted small" style={{ marginTop: 10 }}>Revoke active punishments from <Link href="/admin/bans">Bans &amp; Mutes</Link>.</p>}
      </section>

      <section className="pd-section">
        <h2>Staff notes</h2>
        {isMod && (
          <form action={addNote} className="pd-form card" style={{ marginBottom: 14 }}>
            <input type="hidden" name="uuid" value={player.uuid} />
            <label className="field">
              <span>Add a note (visible to staff only)</span>
              <textarea name="text" required maxLength={MAX_NOTE} />
            </label>
            <button className="btn primary sm" type="submit" style={{ justifySelf: "start" }}>Add note</button>
          </form>
        )}
        <ul className="pd-notes">
          {notes.map((n, i) => (
            <li key={String(n._id ?? i)}><small>{n.by} · {fmtDate(n.at)}</small>{n.text}</li>
          ))}
          {notes.length === 0 && <li className="muted">No notes yet.</li>}
        </ul>
      </section>
    </>
  );
}
