import Link from "next/link";
import type { QueryFilter } from "mongoose";
import { connectDB } from "@/server/db";
import { Player } from "@/server/models/Player";
import { Punishment } from "@/server/models/Punishment";
import { requireRole } from "@/server/guard";
import { ACTIVE_TYPES, BAN_TYPES, PAGE_SIZE, escapeRegex, formatMinutes, isBanType, isValidUuid, parsePage } from "@/server/players-util";
import { expireStale } from "./punish-core";
import { Avatar, Pager, fmtDate, qs } from "./ui";
import "../players.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Players — Admin" };

const FILTERS = ["all", "online", "offline", "banned", "whitelisted"] as const;
type Filter = (typeof FILTERS)[number];

type SP = { q?: string; status?: string; page?: string; error?: string };

export default async function PlayersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole("viewer");
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().slice(0, 32);
  const status: Filter = (FILTERS as readonly string[]).includes(sp.status ?? "") ? (sp.status as Filter) : "all";

  await connectDB();
  await expireStale();

  const where: QueryFilter<Record<string, unknown>> = {};
  if (q) {
    const or: Record<string, unknown>[] = [{ name: { $regex: escapeRegex(q), $options: "i" } }];
    if (isValidUuid(q)) or.push({ uuid: q.toLowerCase() });
    where.$or = or;
  }
  if (status === "online") where.online = true;
  else if (status === "offline") where.online = { $ne: true };
  else if (status === "whitelisted") where.whitelisted = true;
  else if (status === "banned") {
    const uuids = await Punishment.distinct("playerUuid", { active: true, type: { $in: [...BAN_TYPES] } });
    where.uuid = { $in: uuids };
  }

  const total = await Player.countDocuments(where);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = parsePage(sp.page, pages);
  const players = await Player.find(where)
    .sort({ online: -1, lastSeen: -1, name: 1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  // Active bans / mutes for the rows on this page.
  const punished = await Punishment.find({ playerUuid: { $in: players.map((p) => p.uuid) }, active: true, type: { $in: [...ACTIVE_TYPES] } })
    .select("playerUuid type")
    .lean();
  const flags = new Map<string, { banned: boolean; muted: boolean }>();
  for (const x of punished) {
    const f = flags.get(x.playerUuid) ?? { banned: false, muted: false };
    if (isBanType(x.type)) f.banned = true;
    else f.muted = true;
    flags.set(x.playerUuid, f);
  }

  const params = { q: q || undefined, status: status === "all" ? undefined : status };

  return (
    <>
      <h1 className="admin-h">Players</h1>
      {sp.error && <p className="notice err" role="alert">{sp.error}</p>}
      <form className="pl-bar" method="get" action="/admin/players">
        <label className="field">
          <span>Search by name</span>
          <input name="q" defaultValue={q} placeholder="Steve" maxLength={32} autoComplete="off" />
        </label>
        <label className="field narrow">
          <span>Show</span>
          <select name="status" defaultValue={status}>
            {FILTERS.map((f) => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
          </select>
        </label>
        <button className="btn primary sm" type="submit">Search</button>
        {(q || status !== "all") && <Link className="btn ghost sm" href="/admin/players">Reset</Link>}
      </form>

      <div className="card table-wrap">
        <table className="pl-table">
          <thead>
            <tr><th>Player</th><th>Edition</th><th>Rank</th><th>Playtime</th><th>Last seen</th><th>Status</th></tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const f = flags.get(p.uuid);
              return (
                <tr key={p.uuid}>
                  <td>
                    <span className="pl-name">
                      <Avatar name={p.name} />
                      <Link href={`/admin/players/${encodeURIComponent(p.uuid)}`}>{p.name}</Link>
                    </span>
                  </td>
                  <td>{p.edition}</td>
                  <td>{p.rankKey || "default"}</td>
                  <td>{formatMinutes(p.playtimeMinutes)}</td>
                  <td>{p.online ? "Online now" : fmtDate(p.lastSeen)}</td>
                  <td>
                    <span className="chips">
                      {p.online ? <span className="chip on">online</span> : <span className="chip">offline</span>}
                      {p.whitelisted && <span className="chip on">whitelisted</span>}
                      {f?.banned && <span className="chip bad">banned</span>}
                      {f?.muted && <span className="chip warn">muted</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
            {players.length === 0 && (
              <tr><td colSpan={6} className="muted">No players found. Players appear here once the TurtureBridge plugin syncs them.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager base="/admin/players" params={params} page={page} pages={pages} total={total} />
    </>
  );
}
