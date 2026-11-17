import { connectDB } from "@/server/db";
import { AntiCheatAlert } from "@/server/models";
import { requireRole } from "@/server/guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Anti-cheat — Admin" };

export default async function AntiCheatPage() {
  await requireRole("admin");
  await connectDB();
  const alerts = await AntiCheatAlert.find().sort({ createdAt: -1 }).limit(200).lean();

  return (
    <>
      <h1 className="admin-h">Anti-cheat alerts</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        GrimAC flags grouped by player and check. These alerts do not automatically punish players; review before acting.
      </p>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Player</th>
              <th>Check</th>
              <th>Flags</th>
              <th>GrimAC detail</th>
              <th>Server</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 && <tr><td colSpan={6} className="muted">No anti-cheat alerts yet.</td></tr>}
            {alerts.map((alert) => (
              <tr key={String(alert._id)}>
                <td>{new Date(alert.createdAt).toLocaleString("en-IN")}</td>
                <td>
                  {alert.playerName}
                  <br />
                  <small className="muted">{alert.playerUuid}</small>
                </td>
                <td><code>{alert.checkName}</code></td>
                <td>{alert.flagCount} / {alert.threshold} in {alert.windowSeconds}s</td>
                <td className="muted"><small>{alert.verbose || "—"}</small></td>
                <td>{alert.serverName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
