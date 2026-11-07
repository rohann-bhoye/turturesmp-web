"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icons";
import type { NavItem } from "./AdminNav";

// Wraps the admin pages. On desktop it is a plain sidebar layout; on phones the sidebar becomes a
// slide-in drawer opened from a top bar (hamburger), closed by the X, the dark overlay, Esc or navigating.
export default function AdminShell({ items, side, children }: { items: NavItem[]; side: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const current = [...items].sort((a, b) => b.href.length - a.href.length).find((i) => (i.href === "/admin" ? path === "/admin" : path.startsWith(i.href)));

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className={`admin${open ? " nav-open" : ""}`}>
      <header className="admin-topbar">
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="admin-side">
          <Icon name="menu" />
        </button>
        <Link href="/admin" className="admin-topbar-title">
          <span className="logo-mark"><Icon name="pickaxe" /></span>
          <b>{current?.label ?? "Admin"}</b>
        </Link>
      </header>
      <div className="admin-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <aside id="admin-side" className="admin-side" aria-label="Admin menu">
        <button className="icon-btn admin-close" onClick={() => setOpen(false)} aria-label="Close menu">
          <Icon name="close" />
        </button>
        {side}
      </aside>
      <section className="admin-main">{children}</section>
    </div>
  );
}
