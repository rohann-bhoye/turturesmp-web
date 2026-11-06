"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; soon?: boolean };

export default function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Admin">
      {items.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={active ? "active" : undefined}>
            {i.label}
            {i.soon && <em>soon</em>}
          </Link>
        );
      })}
    </nav>
  );
}
