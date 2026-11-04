import CopyIP from "@/components/CopyIP";
import DiscordWidget from "@/components/DiscordWidget";
import { StatusPill, StatsRow } from "@/components/ServerStatus";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Pixel from "@/components/PixelArt";
import Link from "next/link";
import { BEDROCK_IP, BEDROCK_PORT, DISCORD_INVITE, SERVER_IP } from "@/lib";
import { faq, news, rules } from "@/data";

const features = [
  { i: "⛏️", t: "Vanilla+ Survival", d: "Classic survival you love, with small quality-of-life upgrades that keep it fun." },
  { i: "🛡️", t: "Land Protection", d: "Claim your base and builds. Griefers and thieves are not welcome here." },
  { i: "💎", t: "Player Economy", d: "Earn, trade and run shops with other players. Build your own empire." },
  { i: "🎉", t: "Weekly Events", d: "PvP tournaments, build contests and giveaways with real rewards." },
  { i: "🤝", t: "Friendly Community", d: "Active staff and helpful players. New to Minecraft? You'll fit right in." },
  { i: "⚡", t: "Lag-free Gameplay", d: "Optimised hosting and 24/7 uptime so your adventure never stops." },
];

const steps = [
  { n: "1", t: "Open Minecraft", d: "Launch Minecraft Java Edition (or Bedrock via Geyser)." },
  { n: "2", t: "Add Server", d: `Go to Multiplayer → Add Server and paste ${SERVER_IP}.` },
  { n: "3", t: "Join Discord", d: "Say hello in our Discord to get your role and chat with the community." },
  { n: "4", t: "Start Playing", d: "Spawn in, claim your land and begin your SMP story!" },
];

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <section className="hero" id="home">
          <div className="hero-bg" />
          <div className="leaves" aria-hidden="true" />
          <div className="container hero-in">
            <div className="hero-char left"><Pixel name="steve" size={9} className="bob" title="Steve" /></div>
            <div className="hero-center">
              <StatusPill />
              <h1 className="pixel">
                TURTURE <span>SMP</span>
              </h1>
              <p className="lead">
                A friendly survival Minecraft server for builders, explorers and friends. Jump in, claim your land and
                become part of the story.
              </p>
              <CopyIP />
              <div className="cta">
                <a className="btn primary" href="#join">Play Now</a>
                <a className="btn discord" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Join Discord</a>
              </div>
            </div>
            <div className="hero-char right"><Pixel name="alex" size={9} className="bob b2" title="Alex" /></div>
          </div>
        </section>

        <section className="container">
          <StatsRow />
        </section>

        <section className="container section" id="features">
          <h2 className="pixel title">Why Turture?</h2>
          <div className="grid">
            {features.map((f) => (
              <div className="card" key={f.t}>
                <div className="ico">{f.i}</div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container section" id="join">
          <h2 className="pixel title">How to Join</h2>
          <div className="steps">
            {steps.map((s) => (
              <div className="step" key={s.n}>
                <span className="num pixel">{s.n}</span>
                <div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="center-row">
            <CopyIP />
          </div>
          <div className="card bedrock">
            <h3>📱 Bedrock Edition (mobile / console / Windows)</h3>
            <p>
              Address: <code>{BEDROCK_IP}</code> · Port: <code>{BEDROCK_PORT}</code>
            </p>
          </div>
        </section>

        <section className="container section" id="news">
          <h2 className="pixel title">Latest News</h2>
          <div className="grid">
            {news.map((n) => (
              <article className="card news" key={n.t}>
                <div className="news-top">
                  <span className="tag">{n.tag}</span>
                  <span className="muted">{n.date}</span>
                </div>
                <h3>{n.t}</h3>
                <p>{n.d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container section" id="community">
          <h2 className="pixel title">Our Community</h2>
          <div className="two">
            <DiscordWidget />
            <div className="card rules" id="rules">
              <h3>📜 Server Rules</h3>
              <ol>
                {rules.slice(0, 5).map((r) => (
                  <li key={r.t}>{r.t}. <span className="muted">{r.d}</span></li>
                ))}
              </ol>
              <Link className="btn primary sm-block" href="/rules">All rules</Link>
            </div>
          </div>
        </section>

        <section className="container section" id="faq">
          <h2 className="pixel title">FAQ</h2>
          <div className="faq">
            {faq.map((f) => (
              <details className="card" key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="container section">
          <div className="final">
            <div className="final-art">
              <Pixel name="creeper" size={6} className="bob" />
              <Pixel name="diamond" size={6} className="bob b2" />
              <Pixel name="grass" size={6} className="bob" />
            </div>
            <h2 className="pixel">Ready to play?</h2>
            <p>Your next adventure is one click away.</p>
            <CopyIP />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
