import CopyIP from "@/components/CopyIP";
import DiscordWidget from "@/components/DiscordWidget";
import { StatusPill, StatsRow } from "@/components/ServerStatus";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Pixel from "@/components/PixelArt";
import Scene from "@/components/Scene";
import Parallax from "@/components/Parallax";
import Reveal from "@/components/Reveal";
import SectionHead from "@/components/SectionHead";
import Icon, { IconName } from "@/components/Icons";
import Link from "next/link";
import { BEDROCK_IP, BEDROCK_PORT, DISCORD_INVITE, SERVER_IP } from "@/lib";
import { faq, news, rules } from "@/data";

const features: { i: IconName; t: string; d: string }[] = [
  { i: "pickaxe", t: "Vanilla+ Survival", d: "Classic survival you love, with small quality-of-life upgrades that keep it fun." },
  { i: "shield", t: "Land Protection", d: "Claim your base and builds. Griefers and thieves are not welcome here." },
  { i: "gem", t: "Player Economy", d: "Earn, trade and run shops with other players. Build your own empire." },
  { i: "trophy", t: "Weekly Events", d: "PvP tournaments, build contests and giveaways with real rewards." },
  { i: "users", t: "Friendly Community", d: "Active staff and helpful players. New to Minecraft? You'll fit right in." },
  { i: "zap", t: "Lag-free Gameplay", d: "Optimised hosting and 24/7 uptime so your adventure never stops." },
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
          <Scene left="steve" right="alex" />
          <Parallax />
          <div className="container hero-in">
            <StatusPill />
            <h1>
              TURTURE <span>SMP</span>
            </h1>
            <p className="lead">
              A friendly survival Minecraft server for builders, explorers and friends. Jump in, claim your land and
              become part of the story.
            </p>
            <CopyIP />
            <div className="cta">
              <a className="btn primary" href="#join">Play Now <Icon name="arrow" /></a>
              <a className="btn ghost" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
                <Icon name="discord" /> Join Discord
              </a>
            </div>
          </div>
          <span className="scroll-cue" aria-hidden="true" />
        </section>

        <section className="container">
          <StatsRow />
        </section>

        <section className="container section" id="features">
          <SectionHead eyebrow="Why Turture" title="Survival, but better" sub="Everything you love about Minecraft, polished for a smoother, friendlier world." />
          <div className="grid">
            {features.map((f) => (
              <div className="card feature" key={f.t} data-reveal>
                <div className="ico"><Icon name={f.i} /></div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container section" id="join">
          <SectionHead eyebrow="How to join" title="Playing in four steps" sub="Java and Bedrock players are both welcome." />
          <div className="steps">
            {steps.map((s) => (
              <div className="card step" key={s.n} data-reveal>
                <span className="num pixel">{s.n}</span>
                <div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="center-row" data-reveal>
            <CopyIP />
          </div>
          <div className="card bedrock" data-reveal>
            <h3>Bedrock Edition (mobile / console / Windows)</h3>
            <p>
              Address: <code>{BEDROCK_IP}</code> · Port: <code>{BEDROCK_PORT}</code>
            </p>
          </div>
        </section>

        <section className="container section" id="news">
          <SectionHead eyebrow="News" title="Latest from the world" />
          <div className="grid">
            {news.map((n) => (
              <article className="card news" key={n.t} data-reveal>
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
          <SectionHead eyebrow="Community" title="Join the family" sub="Chat, trade, get support and take part in events." />
          <div className="two">
            <DiscordWidget />
            <div className="card rules" id="rules" data-reveal>
              <h3>Server Rules</h3>
              <ol>
                {rules.slice(0, 5).map((r) => (
                  <li key={r.t}>{r.t}. <span className="muted">{r.d}</span></li>
                ))}
              </ol>
              <Link className="btn primary sm" style={{ marginTop: 20 }} href="/rules">All rules <Icon name="arrow" /></Link>
            </div>
          </div>
        </section>

        <section className="container section" id="faq">
          <SectionHead eyebrow="FAQ" title="Questions? Answered." />
          <div className="faq">
            {faq.map((f) => (
              <details className="card" key={f.q} data-reveal>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="container section">
          <div className="final" data-reveal>
            <h2>Ready to play?</h2>
            <p>Your next adventure is one click away.</p>
            <CopyIP />
            <div className="final-ground" />
            <div className="final-art" aria-hidden="true">
              <Pixel name="creeper" size={8} className="bob" />
              <Pixel name="diamond" size={8} className="bob b2" />
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
