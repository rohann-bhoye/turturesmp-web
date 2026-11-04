import PageShell from "@/components/PageShell";
import { team } from "@/data";
import { DISCORD_INVITE } from "@/lib";

export const metadata = { title: "Team — Turture SMP" };

export default function Team() {
  return (
    <PageShell title="Staff & Team" intro="The people who keep Turture SMP fun and fair." art="steve">
      <div className="grid four">
        {team.map((m) => (
          <div className="card member" key={m.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://mc-heads.net/avatar/${encodeURIComponent(m.name)}/96`} alt={m.name} width={96} height={96} />
            <h3>{m.name}</h3>
            <span className="role" style={{ color: m.color }}>{m.role}</span>
            <p>{m.bio}</p>
          </div>
        ))}
      </div>
      <div className="final apply">
        <h2 className="pixel">Want to join the team?</h2>
        <p>Be active, kind and helpful. Ask about staff applications in our Discord.</p>
        <a className="btn discord" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Ask on Discord</a>
      </div>
    </PageShell>
  );
}
