"use client";
import { useRef, useState } from "react";
import type { Boards, LbRow, Metric } from "@/server/leaderboard";

// Titles and colours follow the in-game rotating leaderboards (TOP KILLS / DEATHS / PLAYTIME / BALANCE).
const TABS: { id: Metric; label: string; title: string; icon: string; color: string; blurb: string }[] = [
  { id: "kills", label: "Warriors", title: "Top Kills", icon: "⚔️", color: "#ee2a2a", blurb: "Most mobs and players slain" },
  { id: "playtime", label: "Veterans", title: "Top Playtime", icon: "⏳", color: "#ffe344", blurb: "Longest time spent on the server" },
  { id: "balance", label: "Tycoons", title: "Top Balance", icon: "💎", color: "#74fd7b", blurb: "Richest players on Turture SMP" },
  { id: "deaths", label: "Fallen", title: "Top Deaths", icon: "☠️", color: "#ff5c5c", blurb: "The bravest, or the clumsiest" },
];
const COLS: Metric[] = ["kills", "deaths", "playtime", "balance"];
const COL_LABEL: Record<Metric, string> = { kills: "Kills", deaths: "Deaths", playtime: "Playtime", balance: "Balance" };
const MEDALS = ["🥇", "🥈", "🥉"];

function Face({ name, size }: { name: string; size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size * 2}`} alt="" width={size} height={size} loading="lazy" />;
}

function RankChip({ row }: { row: LbRow }) {
  return (
    <span className="lb-chip" style={{ ["--c" as string]: row.rankColor }}>
      {row.rankName}
    </span>
  );
}

export default function LeaderboardTabs({ boards }: { boards: Boards }) {
  const [tab, setTab] = useState<Metric>("kills");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cur = TABS.find((t) => t.id === tab) ?? TABS[0];
  const rows = boards[tab];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(n.id);
    refs.current[n.id]?.focus();
  };

  return (
    <div className="lb" style={{ ["--lb" as string]: cur.color }}>
      <div className="lb-tabs" role="tablist" aria-label="Leaderboards">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            role="tab"
            id={`lb-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="lb-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? "on" : ""}
            style={{ ["--c" as string]: t.color }}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="lb-ico" aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div id="lb-panel" role="tabpanel" aria-labelledby={`lb-tab-${tab}`} key={tab} className="lb-panel">
        <div className="lb-head">
          <h2>{cur.icon} {cur.title}</h2>
          <p className="muted">{cur.blurb}</p>
        </div>

        {rows.length === 0 ? (
          <div className="card lb-empty">
            <b>No stats here yet</b>
            <span className="muted">Join the server and play. This board fills up as players earn their place.</span>
          </div>
        ) : (
          <>
            <div className="podium">
              {[1, 0, 2].map((idx) => {
                const p = podium[idx];
                if (!p) return <div key={idx} aria-hidden />;
                return (
                  <div className={`card pod p${idx + 1}`} key={p.uuid}>
                    <span className="medal" aria-label={`Place ${idx + 1}`}>{MEDALS[idx]}</span>
                    <Face name={p.name} size={72} />
                    <h3>{p.name}{p.online && <i className="lb-dot" title="Online now" />}</h3>
                    <RankChip row={p} />
                    <b className="lb-val">{p.values[tab]}</b>
                  </div>
                );
              })}
            </div>

            {rest.length > 0 && (
              <div className="card lb-list">
                <div className="lb-row lb-th" aria-hidden>
                  <span>#</span>
                  <span>Player</span>
                  {COLS.map((c) => <span key={c} className={`lb-c${c === tab ? " act" : ""}`}>{COL_LABEL[c]}</span>)}
                </div>
                {rest.map((p, i) => (
                  <div className="lb-row" key={p.uuid}>
                    <span className="lb-pos">{i + 4}</span>
                    <span className="lb-who">
                      <Face name={p.name} size={32} />
                      <span>
                        <b>{p.name}{p.online && <i className="lb-dot" title="Online now" />}</b>
                        <RankChip row={p} />
                      </span>
                    </span>
                    {COLS.map((c) => (
                      <span key={c} className={`lb-c${c === tab ? " act" : ""}`}>{p.values[c]}</span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
