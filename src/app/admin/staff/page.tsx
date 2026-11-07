import { connectDB } from "@/server/db";
import { User } from "@/server/models";
import { requireRole } from "@/server/guard";
import { ROLES } from "@/server/roles";
import Link from "next/link";
import { isMaster } from "@/server/master";
import { setRole, removeStaff } from "./actions";

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ saved?: string; removed?: string; confirm?: string; error?: string }> }) {
  const me = await requireRole("owner");
  const { saved, removed, confirm, error } = await searchParams;
  await connectDB();
  const users = await User.find().sort({ lastLoginAt: -1 }).limit(200).lean();
  const iAmMaster = isMaster(me.discordId);
  const pending = users.find((u) => String(u._id) === confirm && u.role !== "user" && !isMaster(u.discordId) && (u.role !== "owner" || iAmMaster));
  return (
    <>
      <h1 className="admin-h">Staff &amp; roles</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Everyone who logs in with Discord appears here as <b>user</b>. Give a role to let them into the admin panel.
        Viewer: read only · Mod: players and bans · Admin: settings, ranks, store · Owner: everything, including roles (1 master + 2 more owners; only the master owner can add or remove owners).
      </p>
      {!iAmMaster && <p className="notice" role="note">Only the master owner can make someone an Owner or remove an Owner.</p>}
      {saved && <p className="notice ok" role="status">Role updated.</p>}
      {removed && <p className="notice ok" role="status">Removed from staff.</p>}
      {pending && (
        <div className="notice err" role="alert">
          <p style={{ marginBottom: 10 }}>
            Remove <b>{pending.username}</b> ({pending.role}) from staff? They will lose access to the admin panel. Their account and history stay.
          </p>
          <form action={removeStaff} className="inline-form">
            <input type="hidden" name="userId" value={String(pending._id)} />
            <button className="btn sm">Yes, remove</button>
            <Link href="/admin/staff" className="btn ghost sm">Cancel</Link>
          </form>
        </div>
      )}
      {error && <p className="notice err" role="alert">{error}</p>}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>User</th><th className="hide-sm">Minecraft</th><th className="hide-sm">Last login</th><th>Role</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={String(u._id)}>
                <td>{u.username}<br /><small className="muted">{u.discordId}</small></td>
                <td className="hide-sm">{u.minecraft?.name || "—"}</td>
                <td className="hide-sm">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-IN") : "—"}</td>
                <td>
                  {String(u._id) === me.id ? (
                    <span className={`role-chip r-${u.role}`}>{u.role} ({iAmMaster ? "master, you" : "you"})</span>
                  ) : isMaster(u.discordId) ? (
                    <span className="role-chip r-owner">owner (master)</span>
                  ) : u.role === "owner" && !iAmMaster ? (
                    <span className="role-chip r-owner">owner (protected)</span>
                  ) : (
                    <form action={setRole} className="inline-form">
                      <input type="hidden" name="userId" value={String(u._id)} />
                      <select name="role" defaultValue={u.role} aria-label={`Role for ${u.username}`}>
                        {ROLES.filter((r) => r !== "owner" || iAmMaster).map((r) => <option key={r}>{r}</option>)}
                      </select>
                      <button className="btn ghost sm">Save</button>
                      {u.role !== "user" && <Link href={`/admin/staff?confirm=${String(u._id)}`} className="btn ghost sm">Remove</Link>}
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
