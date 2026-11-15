import { connectDB } from "@/server/db";
import { Rank } from "@/server/models/Rank";
import { requireRole } from "@/server/guard";
import { saveLimits } from "./actions";
import { LIMITS, numberFromPerms } from "./limits-def";
import "./limits.css";

export const metadata = { title: "Limits — Admin" };
export const dynamic = "force-dynamic";

export default async function LimitsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; nodefault?: string }> }) {
  await requireRole("admin");
  const sp = await searchParams;
  await connectDB();
  const ranks = await Rank.find().sort({ weight: 1 }).lean();

  // The Essentials side: home numbers live in plugins/Essentials/config.yml, keyed by rank name.
  const snippet = ["sethome-multiple:", ...ranks.filter((r) => r.limits?.homes).map((r) => `  ${r.key}: ${r.limits!.homes}`)].join("\n");

  return (
    <>
      <h1 className="admin-h">Limits per rank</h1>
      <p className="muted lm-lead">Set how many homes, auction listings and jobs each rank gets. Saving writes the permission nodes into the rank and sends them to the server in a few seconds. Higher ranks inherit from lower ones, and the biggest number wins.</p>
      {sp.saved && <p className="notice ok" role="status">Saved. {sp.saved === "0" ? "Nothing needed to change on the server." : `${sp.saved} rank(s) are being updated on the server.`} Now copy the Essentials block below if you changed homes.</p>}
      {sp.error && <p className="notice err" role="alert">{sp.error}</p>}

      <form action={saveLimits} className="lm-form">
        <ul className="lm-list">
          {ranks.map((r) => (
            <li key={r.key} className="card lm-row" style={{ ["--c" as string]: r.color || "#8fa399" }}>
              <div className="lm-name"><i /> <b>{r.displayName}</b> <small className="muted">{r.key}{r.isDefault ? " · default" : ""}</small></div>
              {LIMITS.map((l) => (
                <label key={l.id} className="field"><span>{l.label}</span><input name={`${l.id}_${r.key}`} type="number" min={1} max={1000} inputMode="numeric" defaultValue={r.limits?.[l.id] ?? (l.prefix ? numberFromPerms(r.permissions, l.prefix) : undefined) ?? ""} placeholder="not set" /></label>
              ))}
            </li>
          ))}
        </ul>
        <button className="btn primary" type="submit">Save limits</button>
      </form>

      <section className="card lm-snip">
        <h2>Essentials block for homes</h2>
        <p className="muted">Essentials keeps the home numbers in its own config. Put this in <code>plugins/Essentials/config.yml</code> (replace the old <code>sethome-multiple</code> block), save it, then run <code>/essentials reload</code> in the console. No restart.</p>
        <pre>{snippet}</pre>
      </section>
    </>
  );
}
