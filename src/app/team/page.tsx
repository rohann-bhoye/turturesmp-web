import PageShell from "@/components/PageShell";
import Icon from "@/components/Icons";
import { DISCORD_INVITE } from "@/lib";
import { getSection } from "@/server/content";

export const metadata = { title: "Team — Turture SMP" };
// Edited in Admin > Site content; the page refreshes at most once a minute (and right after a save).
export const revalidate = 60;

export default async function Team() {
  const team = await getSection("team");
  return (
    <PageShell title="Staff & Team" intro="The people who keep Turture SMP fun and fair." art="steve">
      {team.length > 0 ? (
        <div className="grid four">
          {team.map((m) => (
            <div className="card member" key={m.name} style={{ "--rc": m.color } as React.CSSProperties} data-reveal>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://mc-heads.net/avatar/${encodeURIComponent(m.name)}/96`} alt={m.name} width={96} height={96} />
              <h3>{m.name}</h3>
              <span className="role" style={{ color: m.color }}>{m.role}</span>
              {m.bio && <p>{m.bio}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="card center-text" data-reveal style={{ maxWidth: 560, margin: "0 auto", padding: "36px 24px" }}>
          <h3>Meet the team soon</h3>
          <p className="muted">Our staff list is being put together. Say hello in Discord, someone is always around.</p>
        </div>
      )}
      <div className="final plain apply" data-reveal>
        <h2>Want to join the team?</h2>
        <p>Be active, kind and helpful. Ask about staff applications in our Discord.</p>
        <a className="btn discord" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer"><Icon name="discord" /> Ask on Discord</a>
      </div>
    </PageShell>
  );
}
