"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DISCORD_INVITE } from "@/lib";
import Icon from "./Icons";
import ThemeToggle from "./ThemeToggle";

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
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="nav">
      <div className="container nav-in">
        <Link href="/" className="logo pixel" onClick={() => setOpen(false)}>
          <span className="logo-mark"><Icon name="pickaxe" /></span>
          <b>TURTURE</b>
        </Link>
        <nav className={open ? "links open" : "links"} aria-label="Main">
          {links.map(([l, h]) => (
            <Link key={h} href={h} className={h === pathname ? "active" : undefined} onClick={() => setOpen(false)}>
              {l}
            </Link>
          ))}
          <a className="btn discord sm" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
            <Icon name="discord" /> Discord
          </a>
        </nav>
        <div className="nav-end">
          <a className="btn discord sm" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
            <Icon name="discord" /> Discord
          </a>
          <ThemeToggle />
          <button className="icon-btn burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
    </header>
  );
}
