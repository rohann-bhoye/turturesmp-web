import Link from "next/link";
import { requireRole } from "@/server/guard";
import { connectDB } from "@/server/db";
import { Feedback } from "@/server/models/Feedback";
import { User } from "@/server/models/User";

export const metadata = { title: "Feedback — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminFeedback() {
  await requireRole("viewer");
  await connectDB();

  const feedbacks = await Feedback.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const replies = await User.find({ _id: { $in: feedbacks.map((f) => f.repliedBy).filter(Boolean) } }).lean();
  const replyBy = new Map(replies.map((u) => [String(u._id), u.username]));

  const counts = {
    open: feedbacks.filter((f) => f.status === "open").length,
    read: feedbacks.filter((f) => f.status === "read").length,
    closed: feedbacks.filter((f) => f.status === "closed").length,
  };

  return (
    <>
      <h1 className="admin-h">Feedback & Suggestions</h1>
      <p className="muted ct-lead">
        Messages sent by players from the public feedback page. Mark them read or closed as you handle them.
      </p>

      <div className="kpis" style={{ marginBottom: 24 }}>
        <div className="kpi"><span>Total</span><b>{feedbacks.length}</b></div>
        <div className="kpi"><span>Open</span><b style={{ color: "var(--gold)" }}>{counts.open}</b></div>
        <div className="kpi"><span>Read</span><b>{counts.read}</b></div>
        <div className="kpi"><span>Closed</span><b>{counts.closed}</b></div>
      </div>

      {feedbacks.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <p className="muted">No feedback yet.</p>
        </div>
      ) : (
        <div className="card">
          <table className="admin-feedback-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Player</th>
                <th>Status</th>
                <th>Message</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.map((f) => {
                const statusColor: Record<string, string> = {
                  open: "var(--gold)",
                  read: "var(--muted)",
                  closed: "var(--em)",
                };
                const repliedByName = f.repliedBy ? replyBy.get(String(f.repliedBy)) : null;
                return (
                  <tr key={String(f._id)}>
                    <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{new Date(f.createdAt).toLocaleDateString()}</td>
                    <td><span style={{ textTransform: "capitalize", fontWeight: 600 }}>{f.type}</span></td>
                    <td>{f.minecraftName || "Anonymous"}</td>
                    <td>
                      <span style={{ color: statusColor[f.status] || "var(--text)", fontWeight: 600, fontSize: 12 }}>{f.status}</span>
                      {repliedByName && <i> by {repliedByName}</i>}
                    </td>
                    <td style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.message}</td>
                    <td>
                      <form
                        action={`/admin/feedback/${String(f._id)}/status`}
                        method="POST"
                        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                      >
                        <input type="hidden" name="id" value={String(f._id)} />
                        <select name="status" defaultValue={f.status}>
                          <option value="open">Open</option>
                          <option value="read">Read</option>
                          <option value="closed">Closed</option>
                        </select>
                        <button className="btn primary sm" type="submit">Save</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
