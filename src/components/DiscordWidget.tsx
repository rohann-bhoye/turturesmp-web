"use client";
import { useEffect, useState } from "react";
import { DISCORD_INVITE, DISCORD_SERVER_ID } from "@/lib";
import Icon from "./Icons";

type Widget = { name: string; presence_count: number; members: { id: string; username: string; avatar_url: string; status: string }[] };

export default function DiscordWidget() {
  const [w, setW] = useState<Widget | null>(null);
  useEffect(() => {
    if (!DISCORD_SERVER_ID) return;
    fetch(`https://discord.com/api/guilds/${DISCORD_SERVER_ID}/widget.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setW)
      .catch(() => {});
  }, []);

  return (
    <div className="discord-card" data-reveal>
      <div className="d-head">
        <div className="d-ico" aria-hidden><Icon name="discord" /></div>
        <div>
          <h3>{w?.name || "Turture SMP Discord"}</h3>
          <p className="muted">
            <i className="dot on" /> {w ? `${w.presence_count} members online` : "Chat, trade, get support & events"}
          </p>
        </div>
      </div>
      {w && w.members.length > 0 && (
        <div className="avatars">
          {w.members.slice(0, 12).map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.avatar_url} alt={m.username} title={m.username} width={36} height={36} />
          ))}
        </div>
      )}
      <a className="btn discord" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
        <Icon name="discord" /> Join our Discord
      </a>
    </div>
  );
}
