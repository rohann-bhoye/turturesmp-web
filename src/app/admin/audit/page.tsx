import { connectDB } from "@/server/db";
import { AuditLog } from "@/server/models";
import { requireRole } from "@/server/guard";

export default async function AuditPage() {
  await requireRole("admin");
  await connectDB();
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(200).lean();
  return (
    <>
      <h1 className="admin-h">Audit log</h1>
      <p className="muted" style={{ marginBottom: 16 }}>Every admin action, newest first (last 200).</p>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={5} className="muted">Nothing yet.</td></tr>}
            {logs.map((l) => (
              <tr key={String(l._id)}>
                <td>{new Date(l.createdAt).toLocaleString("en-IN")}</td>
                <td>{l.actorName}</td>
                <td><code>{l.action}</code></td>
                <td>{l.target || "—"}</td>
                <td className="muted"><small>{l.meta ? JSON.stringify(l.meta) : ""}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
