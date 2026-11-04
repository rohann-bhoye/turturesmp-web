import Link from "next/link";
import { DISCORD_INVITE, SERVER_IP } from "@/lib";

export default function Footer() {
  return (
    <footer>
      <div className="container foot-grid">
        <div>
          <b className="pixel">TURTURE SMP</b>
          <p>A friendly survival server. Java &amp; Bedrock.</p>
          <p className="mono">{SERVER_IP}</p>
        </div>
        <nav className="foot-links" aria-label="Footer">
          <Link href="/">Home</Link>
          <Link href="/rules">Rules</Link>
          <Link href="/vote">Vote</Link>
          <Link href="/store">Store</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/gallery">Gallery</Link>
          <Link href="/team">Team</Link>
          <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Discord</a>
        </nav>
      </div>
      <div className="container foot-copy">© {new Date().getFullYear()} Turture SMP · Not affiliated with Mojang or Microsoft.</div>
    </footer>
  );
}
