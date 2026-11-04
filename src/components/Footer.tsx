import Link from "next/link";
import { DISCORD_INVITE, SERVER_IP } from "@/lib";
import Icon from "./Icons";

export default function Footer() {
  return (
    <footer>
      <div className="container foot-grid">
        <div className="foot-brand">
          <span className="logo pixel">
            <span className="logo-mark"><Icon name="pickaxe" /></span>
            <b>TURTURE SMP</b>
          </span>
          <p>A friendly survival server for builders, explorers and friends. Java &amp; Bedrock.</p>
          <span className="mono">{SERVER_IP}</span>
        </div>
        <nav className="foot-col" aria-label="Explore">
          <h4>Explore</h4>
          <Link href="/">Home</Link>
          <Link href="/rules">Rules</Link>
          <Link href="/vote">Vote</Link>
          <Link href="/store">Store</Link>
        </nav>
        <nav className="foot-col" aria-label="Community">
          <h4>Community</h4>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/gallery">Gallery</Link>
          <Link href="/team">Team</Link>
          <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Discord</a>
        </nav>
      </div>
      <div className="container foot-copy">
        <span>© {new Date().getFullYear()} Turture SMP</span>
        <span>Not affiliated with Mojang or Microsoft.</span>
      </div>
    </footer>
  );
}
