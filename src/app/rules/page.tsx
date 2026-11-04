import PageShell from "@/components/PageShell";
import { punishments, rules } from "@/data";

export const metadata = { title: "Rules — Turture SMP" };

export default function Rules() {
  return (
    <PageShell title="Server Rules" intro="Keep it fun and fair for everyone." art="creeper">
      <div className="rule-list">
        {rules.map((r, i) => (
          <div className="card rule" key={r.t} data-reveal>
            <span className="num pixel">{i + 1}</span>
            <div>
              <h3>{r.t}</h3>
              <p>{r.d}</p>
            </div>
          </div>
        ))}
      </div>
      <h2 className="title sub" data-reveal>Punishments</h2>
      <div className="ladder">
        {punishments.map((p, i) => (
          <div className="card rung" key={p} data-reveal>
            <b className="pixel">{i + 1}</b>
            <span>{p}</span>
          </div>
        ))}
      </div>
      <p className="muted center-text">Staff may skip steps for serious offences.</p>
    </PageShell>
  );
}
