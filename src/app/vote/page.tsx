import PageShell from "@/components/PageShell";
import { voteSites } from "@/data";

export const metadata = { title: "Vote — Turture SMP" };

const how = ["Enter your Minecraft name on the voting site", "Click Vote and finish the captcha", "Rewards arrive in game within a minute"];

export default function Vote() {
  return (
    <PageShell title="Vote" intro="Vote every day to support the server and earn rewards in game." art="diamond">
      <div className="grid">
        {voteSites.map((v, i) => (
          <div className="card vote" key={v.name}>
            <span className="num pixel">{i + 1}</span>
            <h3>{v.name}</h3>
            <p>🎁 {v.reward}</p>
            <a className="btn primary sm-block" href={v.url} target="_blank" rel="noopener noreferrer">Vote now</a>
          </div>
        ))}
      </div>
      <h2 className="pixel title sub">How it works</h2>
      <div className="steps three">
        {how.map((h, i) => (
          <div className="step" key={h}>
            <span className="num pixel">{i + 1}</span>
            <p>{h}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
