import PageShell from "@/components/PageShell";
import Icon from "@/components/Icons";
import { DISCORD_INVITE } from "@/lib";
import { getSection } from "@/server/content";

export const metadata = { title: "Vote — Turture SMP" };
// Edited in Admin > Site content; the page refreshes at most once a minute (and right after a save).
export const revalidate = 60;

const how = ["Enter your Minecraft name on the voting site", "Click Vote and finish the captcha", "Say hi in Discord if your reward does not arrive"];

export default async function Vote() {
  const sites = await getSection("vote");
  return (
    <PageShell title="Vote" intro="Voting helps Turture SMP get found by new players." art="diamond">
      {sites.length > 0 ? (
        <>
          <div className="grid">
            {sites.map((v, i) => (
              <div className="card vote" key={v.url} data-reveal>
                <span className="num pixel">{i + 1}</span>
                <h3>{v.name}</h3>
                {v.reward && <p className="reward"><Icon name="gift" /> {v.reward}</p>}
                <a className="btn primary sm-block" href={v.url} target="_blank" rel="noopener noreferrer">Vote now <Icon name="arrow" /></a>
              </div>
            ))}
          </div>
          <h2 className="title sub" data-reveal>How it works</h2>
          <div className="steps three">
            {how.map((h, i) => (
              <div className="card step" key={h} data-reveal>
                <span className="num pixel">{i + 1}</span>
                <p>{h}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card center-text" data-reveal style={{ maxWidth: 560, margin: "0 auto", padding: "36px 24px" }}>
          <h3>Voting is not open yet</h3>
          <p className="muted">We are setting up our voting links. Join Discord to hear the moment they go live.</p>
          <a className="btn discord" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" style={{ marginTop: 16 }}><Icon name="discord" /> Join Discord</a>
        </div>
      )}
    </PageShell>
  );
}
