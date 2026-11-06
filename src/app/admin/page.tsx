import Link from "next/link";
import { connectDB } from "@/server/db";
import { Appeal, Order, Player, Punishment, ServerSettings, User } from "@/server/models";
import { getCurrentUser } from "@/server/session";
import { hasRole } from "@/server/roles";

export default async function Dashboard() {
  const user = await getCurrentUser();
  await connectDB();
  const since = new Date(Date.now() - 30 * 864e5);
  const [players, online, bans, appeals, staff, orders, revenue, settings] = await Promise.all([
    Player.countDocuments(),
    Player.countDocuments({ online: true }),
    Punishment.countDocuments({ active: true, type: { $in: ["ban", "tempban", "ipban"] } }),
    Appeal.countDocuments({ status: "open" }),
    User.countDocuments({ role: { $in: ["viewer", "mod", "admin", "owner"] } }),
    Order.countDocuments({ status: { $in: ["paid", "delivered"] }, createdAt: { $gte: since } }),
    Order.aggregate([
      { $match: { status: { $in: ["paid", "delivered"] }, createdAt: { $gte: since } } },
      { $group: { _id: "$currency", total: { $sum: "$total" } } },
    ]),
    ServerSettings.findOne({ key: "main" }).lean(),
  ]);
  const money = (cur: string, minor: number) => (cur === "INR" ? "₹" : "$") + (minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const revText = revenue.length ? revenue.map((r: { _id: string; total: number }) => money(r._id, r.total)).join(" + ") : "—";
  const bridgeSeen = settings?.bridge?.lastSeenAt ? new Date(settings.bridge.lastSeenAt) : null;
  const bridgeOnline = !!bridgeSeen && Date.now() - bridgeSeen.getTime() < 120000;

  return (
    <>
      <h1 className="admin-h">Welcome back, {user?.username}</h1>
      <div className="kpis">
        <div className="kpi"><span>Players online</span><b>{online}</b></div>
        <div className="kpi"><span>Known players</span><b>{players}</b></div>
        <div className="kpi"><span>Active bans</span><b>{bans}</b></div>
        <div className="kpi"><span>Open appeals</span><b>{appeals}</b></div>
        <div className="kpi"><span>Staff accounts</span><b>{staff}</b></div>
        <div className="kpi"><span>Orders (30 days)</span><b>{orders}</b></div>
        <div className="kpi wide"><span>Revenue (30 days)</span><b>{revText}</b></div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h3>Server connection</h3>
        <p className="status-line">
          <i className={`dot ${bridgeOnline ? "on" : ""}`} />
          {bridgeOnline ? "TurtureBridge plugin connected" : "TurtureBridge plugin not connected yet"}
        </p>
        <p className="muted">
          Player data, bans, ranks and store deliveries sync with the Minecraft server through the TurtureBridge plugin (see bridge-plugin/README.md).
        </p>
        {hasRole(user?.role, "admin") && <Link className="btn primary sm" style={{ marginTop: 14 }} href="/admin/settings">Open server settings</Link>}
      </div>
    </>
  );
}
