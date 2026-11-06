import Link from "next/link";
import PageShell from "@/components/PageShell";
import { connectDB } from "@/server/db";
import { Appeal, Punishment } from "@/server/models/Punishment";
import { User } from "@/server/models/User";
import { getCurrentUser } from "@/server/session";
import { ACTIVE_TYPES, MAX_APPEAL, escapeRegex } from "@/server/players-util";
import { submitAppeal } from "./actions";
import "../admin/players.css";

export const metadata = { title: "Appeal a punishment — Turture SMP" };
export const dynamic = "force-dynamic";

const fmt = (d?: Date | string | null) => (d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default async function AppealPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const user = await getCurrentUser().catch(() => null);

  let body: React.ReactNode;
  if (!user) {
    body = (
      <div className="card pd-card">
        <h2>Sign in to appeal</h2>
        <p className="muted">Appeals are linked to your Discord account so staff can reply to you. Sign in, then come back to this page.</p>
        <Link className="btn discord" href="/login?next=/appeal">Sign in with Discord</Link>
      </div>
    );
  } else {
    let loadError = false;
    let mcName: string | undefined;
    let items: { id: string; type: string; reason: string; at: Date; expiresAt?: Date | null; hasOpen: boolean }[] = [];
    try {
      await connectDB();
      const account = await User.findById(user.id).select("minecraft").lean();
      mcName = account?.minecraft?.name;
      const mcUuid = account?.minecraft?.uuid;
      const or: Record<string, unknown>[] = [];
      if (mcName) or.push({ playerName: { $regex: `^${escapeRegex(mcName)}$`, $options: "i" } });
      if (mcUuid) or.push({ playerUuid: mcUuid });
      if (or.length) {
        const list = await Punishment.find({ active: true, type: { $in: [...ACTIVE_TYPES] }, $or: or }).sort({ createdAt: -1 }).limit(20).lean();
        const open = await Appeal.find({ punishmentId: { $in: list.map((p) => p._id) }, status: "open" }).select("punishmentId").lean();
        const openIds = new Set(open.map((a) => String(a.punishmentId)));
        items = list
          .filter((p) => !p.expiresAt || p.expiresAt.getTime() > Date.now())
          .map((p) => ({ id: String(p._id), type: p.type, reason: p.reason, at: p.createdAt as Date, expiresAt: p.expiresAt, hasOpen: openIds.has(String(p._id)) }));
      }
    } catch (e) {
      console.error("appeal page load failed", e);
      loadError = true;
    }

    if (loadError) {
      body = <div className="card"><p>Appeals are unavailable right now. Please try again later.</p></div>;
    } else if (!mcName && items.length === 0) {
      body = (
        <div className="card pd-card">
          <h2>No Minecraft name linked</h2>
          <p className="muted">Signed in as {user.username}. Your account has no Minecraft name linked yet, so we cannot find your punishments. Ask staff on Discord to link it.</p>
        </div>
      );
    } else if (items.length === 0) {
      body = (
        <div className="card pd-card">
          <h2>Nothing to appeal</h2>
          <p className="muted">{mcName ? `${mcName} has no active ban or mute.` : "No active ban or mute found."}</p>
        </div>
      );
    } else {
      const free = items.filter((i) => !i.hasOpen);
      body = (
        <>
          <div className="card pd-card">
            <h2>Your active punishments</h2>
            <ul className="pd-notes">
              {items.map((i) => (
                <li key={i.id}>
                  <small>{fmt(i.at)} · {i.expiresAt ? `expires ${fmt(i.expiresAt)}` : "permanent"}</small>
                  <b>{i.type}</b>: {i.reason} {i.hasOpen && <span className="chip warn">appeal pending</span>}
                </li>
              ))}
            </ul>
          </div>
          {free.length > 0 ? (
            <form action={submitAppeal} className="card pd-form">
              <h2>Write your appeal</h2>
              <label className="field">
                <span>Punishment</span>
                <select name="punishmentId" required defaultValue={free[0].id}>
                  {free.map((i) => <option key={i.id} value={i.id}>{i.type}: {i.reason.slice(0, 60)}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Why should it be lifted? (20 to {MAX_APPEAL} characters)</span>
                <textarea name="message" required minLength={20} maxLength={MAX_APPEAL} />
              </label>
              <p className="muted small">Be honest and polite. Only one open appeal per punishment. Signed in as {user.username}.</p>
              <button className="btn primary" type="submit">Send appeal</button>
            </form>
          ) : (
            <div className="card"><p>All your punishments already have an appeal waiting for review.</p></div>
          )}
        </>
      );
    }
  }

  return (
    <PageShell title="Appeal a Punishment" intro="Think a ban or mute was a mistake? Tell staff why." art="creeper">
      <div className="appeal-page">
        {saved && <p className="notice ok" role="status">Your appeal was sent. Staff will review it soon.</p>}
        {error && <p className="notice err" role="alert">{error}</p>}
        {body}
      </div>
    </PageShell>
  );
}
