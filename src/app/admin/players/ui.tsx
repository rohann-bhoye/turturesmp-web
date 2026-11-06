import Link from "next/link";

export const fmtDate = (d?: Date | string | null) => (d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

export const avatarUrl = (name: string) => `https://mc-heads.net/avatar/${encodeURIComponent(name)}/32`;

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="pl-av" src={avatarUrl(name)} alt="" width={size} height={size} loading="lazy" style={size !== 32 ? { width: size, height: size } : undefined} />
  );
}

type P = { type: string; active?: boolean; expiresAt?: Date | string | null; revokedBy?: string | null; revokeReason?: string | null };

/** Status chip for a punishment row. */
export function PunishStatus({ p }: { p: P }) {
  if (p.type === "kick" || p.type === "warn") return <span className="chip">done</span>;
  if (p.active) return <span className="chip bad">active</span>;
  if (p.revokedBy === "System") return <span className="chip">expired</span>;
  if (p.revokedBy) return <span className="chip on" title={p.revokeReason || undefined}>revoked</span>;
  return <span className="chip">ended</span>;
}

/** Builds a query string, dropping empty values. */
export const qs = (params: Record<string, string | number | undefined | null>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
};

export function Pager({ base, params, page, pages, total }: { base: string; params: Record<string, string | number | undefined>; page: number; pages: number; total: number }) {
  return (
    <nav className="pager" aria-label="Pagination">
      <span className="muted small">{total} total · page {page} of {pages}</span>
      <span className="chips">
        <Link className="btn ghost sm" aria-disabled={page <= 1} href={`${base}${qs({ ...params, page: page > 2 ? page - 1 : undefined })}`}>← Previous</Link>
        <Link className="btn ghost sm" aria-disabled={page >= pages} href={`${base}${qs({ ...params, page: Math.min(pages, page + 1) })}`}>Next →</Link>
      </span>
    </nav>
  );
}
