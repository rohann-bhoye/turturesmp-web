import { redirect } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icons";
import SetupChecklist from "@/components/admin/SetupChecklist";
import { getCurrentUser, isConfigured } from "@/server/session";

export const metadata = { title: "Staff login — Turture SMP", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  setup: "Login is not set up yet.",
  denied: "You cancelled the Discord login.",
  state: "The login link expired. Please try again.",
  token: "Discord rejected the login. Check the client ID, secret and redirect URL.",
  profile: "Could not read your Discord profile.",
  banned: "This account is blocked.",
  server: "Something went wrong on the server. Check the database connection.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  const configured = isConfigured();
  if (configured) {
    const user = await getCurrentUser().catch(() => null);
    if (user) redirect(safeNext);
  }
  return (
    <main className="auth-wrap">
      <div className="auth-card card">
        <Link href="/" className="logo pixel">
          <span className="logo-mark"><Icon name="pickaxe" /></span>
          <b>TURTURE</b>
        </Link>
        <h1>Staff login</h1>
        <p className="muted">Sign in with Discord to open the admin panel.</p>
        {error && <p className="notice err" role="alert">{errors[error] || "Login failed."}</p>}
        {configured ? (
          <a className="btn discord" href={`/api/auth/discord?next=${encodeURIComponent(safeNext)}`}>
            <Icon name="discord" /> Continue with Discord
          </a>
        ) : (
          <SetupChecklist />
        )}
        <Link className="muted back" href="/">← Back to website</Link>
      </div>
    </main>
  );
}
