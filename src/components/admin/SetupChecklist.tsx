import { setupStatus } from "@/server/session";

const help: Record<string, string> = {
  MONGODB_URI: "MongoDB connection string (MongoDB Atlas)",
  AUTH_SECRET: "Random secret, 32+ characters. Generate with: openssl rand -hex 32",
  DISCORD_CLIENT_ID: "Discord Developer Portal > your app > OAuth2 > Client ID",
  DISCORD_CLIENT_SECRET: "Discord Developer Portal > your app > OAuth2 > Client Secret",
  OWNER_DISCORD_IDS: "Your Discord user ID (comma separated for more owners). These users become Owner on first login.",
};

export default function SetupChecklist() {
  const s = setupStatus();
  return (
    <div className="card setup">
      <h3>Setup needed</h3>
      <p className="muted">Add these to <code>.env.local</code> (local) or your host&apos;s environment settings, then restart.</p>
      <ul>
        {Object.entries(s).map(([k, ok]) => (
          <li key={k} className={ok ? "ok" : "todo"}>
            <i aria-hidden="true">{ok ? "✓" : "•"}</i>
            <div>
              <code>{k}</code>
              <small className="muted">{help[k]}</small>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small">
        In the Discord app, add this redirect URL: <code>{(process.env.SITE_URL || "https://your-site.com").trim().replace(/\/+$/, "") + "/api/auth/callback"}</code>
      </p>
    </div>
  );
}
