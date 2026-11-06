// Small shared helpers for the store admin pages (no server-only code, safe anywhere).

export const fmtDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtDay = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "—";

/** YYYY-MM-DD for <input type="date">. */
export const toDateInput = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export type StoreTab = "overview" | "products" | "orders" | "coupons";
export const STORE_TABS: { key: StoreTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "products", label: "Products" },
  { key: "orders", label: "Orders" },
  { key: "coupons", label: "Coupons" },
];

export function storeHref(params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return "/admin/store" + (s ? "?" + s : "");
}

export const statusClass = (s: string) => `st-chip s-${s}`;

export type StoreSearch = { tab?: string; edit?: string; new?: string; status?: string; q?: string; page?: string; ok?: string; error?: string };
