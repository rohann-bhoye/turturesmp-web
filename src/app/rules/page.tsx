import PageShell from "@/components/PageShell";
import { getSection } from "@/server/content";

export const metadata = { title: "Rules — Turture SMP" };
// Edited in Admin > Site content; the page refreshes at most once a minute (and right after a save).
export const revalidate = 60;

export default async function Rules() {
  const [rules, punishments] = await Promise.all([getSection("rules"), getSection("punishments")]);
  return (
    <PageShell title="Server Rules" intro="Keep it fun and fair for everyone." art="creeper">
      <div className="rule-list">
        {rules.map((r, i) => (
          <div className="card rule" key={`${i}-${r.t}`} data-reveal>
            <span className="num pixel">{i + 1}</span>
            <div>
              <h3>{r.t}</h3>
              <p>{r.d}</p>
            </div>
          </div>
        ))}
      </div>
      {punishments.length > 0 && (
        <>
          <h2 className="title sub" data-reveal>Punishments</h2>
          <div className="ladder">
            {punishments.map((p, i) => (
              <div className="card rung" key={`${i}-${p.label}`} data-reveal>
                <b className="pixel">{i + 1}</b>
                <span>{p.label}</span>
              </div>
            ))}
          </div>
          <p className="muted center-text">Staff may skip steps for serious offences.</p>
        </>
      )}
    </PageShell>
  );
}
