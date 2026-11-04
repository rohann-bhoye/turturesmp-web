"use client";
import { useState } from "react";
import Link from "next/link";
import { DISCORD_INVITE } from "@/lib";

const links = [
  ["Home", "/"],
  ["Join", "/#join"],
  ["Rules", "/rules"],
  ["Vote", "/vote"],
  ["Store", "/store"],
  ["Leaderboard", "/leaderboard"],
  ["Gallery", "/gallery"],
  ["Team", "/team"],
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="nav">
      <div className="container nav-in">
        <Link href="/" className="logo pixel">
          🐢 TURTURE
        </Link>
        <nav className={open ? "links open" : "links"}>
          {links.map(([l, h]) => (
            <Link key={h} href={h} onClick={() => setOpen(false)}>
              {l}
            </Link>
          ))}
          <a className="btn discord sm" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
            Discord
          </a>
        </nav>
        <button className="burger" aria-label="Menu" onClick={() => setOpen(!open)}>
          {open ? "✕" : "☰"}
        </button>
      </div>
    </header>
  );
}
