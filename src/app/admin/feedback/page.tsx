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
        <div className="feedback-admin-list">
          {feedbacks.map((f) => {
            const repliedByName = f.repliedBy ? replyBy.get(String(f.repliedBy)) : null;
            return (
              <article className="card feedback-admin-item" key={String(f._id)}>
                <div className="feedback-admin-heading">
                  <div className="feedback-admin-meta">
                    <span className={`feedback-admin-type type-${f.type}`}>{f.type}</span>
                    <b>{f.minecraftName || "Anonymous"}</b>
                    <time className="muted" dateTime={new Date(f.createdAt).toISOString()}>
                      {new Date(f.createdAt).toLocaleString("en-IN")}
                    </time>
                  </div>
                  <span className={`feedback-admin-status status-${f.status}`}>
                    {f.status}{repliedByName ? ` by ${repliedByName}` : ""}
                  </span>
                </div>

                <p className="feedback-admin-message">{f.message}</p>

                <form action={`/admin/feedback/${String(f._id)}/status`} method="POST" className="feedback-status-form">
                  <input type="hidden" name="id" value={String(f._id)} />
                  <label>
                    <span className="sr-only">Status for feedback from {f.minecraftName || "Anonymous"}</span>
                    <select name="status" defaultValue={f.status}>
                      <option value="open">Open</option>
                      <option value="read">Read</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <button className="btn primary sm" type="submit">Save status</button>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
