import Link from "next/link";
import Icon from "@/components/Icons";
import AdminNav, { NavItem } from "@/components/admin/AdminNav";
import SetupChecklist from "@/components/admin/SetupChecklist";
import { getCurrentUser, isConfigured } from "@/server/session";
import { hasRole, isStaff } from "@/server/roles";

export const metadata = { title: "Admin — Turture SMP", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isConfigured()) {
    return (
      <main className="auth-wrap">
        <SetupChecklist />
      </main>
    );
  }
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return (
      <main className="auth-wrap">
        <div className="auth-card card">
          <h1>Session expired</h1>
          <p className="muted">Please sign in again.</p>
          <Link className="btn discord" href="/login">Sign in</Link>
        </div>
      </main>
    );
  }
  if (!isStaff(user.role)) {
    return (
      <main className="auth-wrap">
        <div className="auth-card card">
          <h1>No access</h1>
          <p className="muted">You are signed in as {user.username}, but this account is not staff. Ask an Owner to give you a role.</p>
          <form action="/api/auth/logout" method="post"><button className="btn ghost">Sign out</button></form>
          <Link className="muted back" href="/">← Back to website</Link>
        </div>
      </main>
    );
  }

  const items: NavItem[] = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/players", label: "Players", soon: true },
    { href: "/admin/bans", label: "Bans & Mutes", soon: true },
    { href: "/admin/ranks", label: "Ranks & Tags", soon: true },
    { href: "/admin/store", label: "Store & Orders", soon: true },
    ...(hasRole(user.role, "admin") ? [{ href: "/admin/settings", label: "Server settings" }] : []),
    ...(hasRole(user.role, "owner") ? [{ href: "/admin/staff", label: "Staff & roles" }] : []),
    ...(hasRole(user.role, "admin") ? [{ href: "/admin/audit", label: "Audit log" }] : []),
  ];

  return (
    <div className="admin">
      <aside className="admin-side">
        <Link href="/" className="logo pixel">
          <span className="logo-mark"><Icon name="pickaxe" /></span>
          <b>ADMIN</b>
        </Link>
        <AdminNav items={items} />
        <div className="admin-user">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" width={36} height={36} />
          ) : (
            <span className="av">{user.username[0]?.toUpperCase()}</span>
          )}
          <div>
            <b>{user.username}</b>
            <span className={`role-chip r-${user.role}`}>{user.role}</span>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="icon-btn" aria-label="Sign out" title="Sign out"><Icon name="close" /></button>
          </form>
        </div>
      </aside>
      <section className="admin-main">{children}</section>
    </div>
  );
}
