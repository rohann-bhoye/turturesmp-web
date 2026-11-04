"use client";
import { useEffect, useState } from "react";
import { SERVER_IP } from "@/lib";

type Status = { online: boolean; players?: { online: number; max: number }; version?: string; motd?: string };

export function useServerStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`https://api.mcstatus.io/v2/status/java/${SERVER_IP}`);
        const d = await r.json();
        if (!alive) return;
        setStatus({
          online: !!d.online,
          players: d.players ? { online: d.players.online, max: d.players.max } : undefined,
          version: d.version?.name_clean,
          motd: d.motd?.clean,
        });
      } catch {
        if (alive) setStatus({ online: false });
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return status;
}

export function StatusPill() {
  const s = useServerStatus();
  const loading = s === null;
  return (
    <span className={`pill ${loading ? "" : s.online ? "on" : "off"}`}>
      <i className="dot" />
      {loading ? "Checking…" : s.online ? `Online · ${s.players?.online ?? 0}/${s.players?.max ?? "?"} players` : "Offline"}
    </span>
  );
}

export function StatsRow() {
  const s = useServerStatus();
  return (
    <div className="stats">
      <div className="stat">
        <b>{s?.online ? s.players?.online ?? 0 : "—"}</b>
        <span>Players online</span>
      </div>
      <div className="stat">
        <b>{s?.online ? s.players?.max ?? "—" : "—"}</b>
        <span>Max slots</span>
      </div>
      <div className="stat">
        <b>{s?.version || "Java"}</b>
        <span>Version</span>
      </div>
      <div className="stat">
        <b>24/7</b>
        <span>Uptime goal</span>
      </div>
    </div>
  );
}
