import PageShell from "@/components/PageShell";
import { leaderboard } from "@/data";

export const metadata = { title: "Leaderboard — Turture SMP" };

const medals = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const top = leaderboard.slice(0, 3);
  return (
    <PageShell title="Leaderboard" intro="Top players on the server. Sample data until live stats are connected." art="steve">
      <div className="podium">
        {[top[1], top[0], top[2]].filter(Boolean).map((p) => {
          const place = leaderboard.indexOf(p);
          return (
            <div className={`card pod p${place + 1}`} key={p.player}>
              <span className="medal">{medals[place]}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://mc-heads.net/avatar/${encodeURIComponent(p.player)}/72`} alt="" width={72} height={72} />
              <h3>{p.player}</h3>
              <span className="muted">{p.playtime} · {p.balance}</span>
            </div>
          );
        })}
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Player</th><th>Playtime</th><th>Kills</th><th>Balance</th></tr>
          </thead>
          <tbody>
            {leaderboard.map((p, i) => (
              <tr key={p.player}>
                <td>{i + 1}</td>
                <td>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://mc-heads.net/avatar/${encodeURIComponent(p.player)}/24`} alt="" width={24} height={24} /> {p.player}
                </td>
                <td>{p.playtime}</td>
                <td>{p.kills}</td>
                <td>{p.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
