import { connectDB } from "@/server/db";
import { User } from "@/server/models";
import { requireRole } from "@/server/guard";
import { ROLES } from "@/server/roles";
import { setRole } from "./actions";

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const me = await requireRole("owner");
  const { saved, error } = await searchParams;
  await connectDB();
  const users = await User.find().sort({ lastLoginAt: -1 }).limit(200).lean();
  return (
    <>
      <h1 className="admin-h">Staff &amp; roles</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Everyone who logs in with Discord appears here as <b>user</b>. Give a role to let them into the admin panel.
        Viewer: read only · Mod: players and bans · Admin: settings, ranks, store · Owner: everything, including roles.
      </p>
      {saved && <p className="notice ok" role="status">Role updated.</p>}
      {error && <p className="notice err" role="alert">{error}</p>}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>User</th><th>Minecraft</th><th>Last login</th><th>Role</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={String(u._id)}>
                <td>{u.username}<br /><small className="muted">{u.discordId}</small></td>
                <td>{u.minecraft?.name || "—"}</td>
                <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-IN") : "—"}</td>
                <td>
                  {String(u._id) === me.id ? (
                    <span className={`role-chip r-${u.role}`}>{u.role} (you)</span>
                  ) : (
                    <form action={setRole} className="inline-form">
                      <input type="hidden" name="userId" value={String(u._id)} />
                      <select name="role" defaultValue={u.role} aria-label={`Role for ${u.username}`}>
                        {ROLES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                      <button className="btn ghost sm">Save</button>
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
