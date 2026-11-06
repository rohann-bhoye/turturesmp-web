// Pure helpers for the Players / Bans features. No database or Next.js imports, so scripts can test them.
import { hasRole, isStaff, type Role } from "./roles";

export const BAN_TYPES = ["ban", "tempban", "ipban"] as const;
export const MUTE_TYPES = ["mute", "tempmute"] as const;
export const ACTIVE_TYPES = [...BAN_TYPES, ...MUTE_TYPES] as const;
export const TEMP_TYPES = ["tempban", "tempmute"] as const;
export const PAGE_SIZE = 25;
export const MAX_REASON = 200;
export const MIN_REASON = 3;
export const MAX_NOTE = 500;
export const MAX_APPEAL = 2000;
export const MAX_DURATION_MINUTES = 10 * 365 * 24 * 60; // 10 years

export const isBanType = (t: string) => (BAN_TYPES as readonly string[]).includes(t);
export const isMuteType = (t: string) => (MUTE_TYPES as readonly string[]).includes(t);
export const isTempType = (t: string) => (TEMP_TYPES as readonly string[]).includes(t);

/** Escapes text so it can be placed inside a RegExp literally (search boxes). */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&");
}

/** Player name: Java 1-16 chars [A-Za-z0-9_]; Bedrock (Floodgate) may start with "." and contain a space. */
export function isValidName(v: unknown): v is string {
  return typeof v === "string" && /^\.?[A-Za-z0-9_]{1,16}( [A-Za-z0-9_]{1,16})?$/.test(v);
}

/** UUID with or without dashes. */
export function isValidUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(v);
}

export const isObjectId = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v);

export function isValidIp(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v);
  if (m) return m.slice(1).every((p) => Number(p) <= 255);
  // IPv6: loose check, hex groups and colons only, at least two colons.
  return /^[0-9a-f:]+$/i.test(v) && (v.match(/:/g) || []).length >= 2 && v.length <= 45 && !/:::/.test(v);
}

/** Hides the host part of an IP: 203.0.113.42 -> 203.0.*.* , IPv6 keeps the first two groups. */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip);
  if (v4) return `${v4[1]}.${v4[2]}.*.*`;
  if (ip.includes(":")) {
    const groups = ip.split(":").filter(Boolean).slice(0, 2);
    return `${groups.join(":")}:*:*`;
  }
  return "***";
}

/** Full IPs are only shown to admin and owner. */
export const showIp = (ip: string | null | undefined, role: Role | undefined) =>
  hasRole(role, "admin") ? ip || "unknown" : maskIp(ip);

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; error: string };

// Control chars, line/paragraph separators and the Minecraft colour sign (built from escapes on purpose).
const UNSAFE_CHARS = new RegExp("[\\u0000-\\u001f\\u007f\\u0085\\u2028\\u2029\\u00a7]", "g");

/** Single-line text for chat/ban screens: strips control chars and the section sign, collapses spaces. */
export function cleanLine(raw: unknown): string {
  return String(raw ?? "")
    .replace(UNSAFE_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateReason(raw: unknown): Ok<string> | Err {
  const v = cleanLine(raw);
  if (v.length < MIN_REASON) return { ok: false, error: `A reason is required (at least ${MIN_REASON} characters).` };
  if (v.length > MAX_REASON) return { ok: false, error: `The reason is too long (max ${MAX_REASON} characters).` };
  return { ok: true, value: v };
}

/** Multi-line free text (notes, appeals). Keeps line breaks, removes control chars. */
export function validateMessage(raw: unknown, min: number, max: number, label: string): Ok<string> | Err {
  const v = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (v.length < min) return { ok: false, error: `${label} is required${min > 1 ? ` (at least ${min} characters)` : ""}.` };
  if (v.length > max) return { ok: false, error: `${label} is too long (max ${max} characters).` };
  return { ok: true, value: v };
}

const UNIT_MINUTES = { minutes: 1, hours: 60, days: 1440 } as const;
export const DURATION_UNITS = Object.keys(UNIT_MINUTES) as (keyof typeof UNIT_MINUTES)[];

/** amount + unit -> whole minutes. Amount must be a positive whole number; total capped at 10 years. */
export function parseDuration(amount: unknown, unit: unknown): Ok<number> | Err {
  const s = String(amount ?? "").trim();
  if (!/^\d{1,7}$/.test(s)) return { ok: false, error: "Duration must be a whole number." };
  const n = Number(s);
  if (n < 1) return { ok: false, error: "Duration must be at least 1." };
  if (typeof unit !== "string" || !(unit in UNIT_MINUTES)) return { ok: false, error: "Pick minutes, hours or days." };
  const minutes = n * UNIT_MINUTES[unit as keyof typeof UNIT_MINUTES];
  if (minutes > MAX_DURATION_MINUTES) return { ok: false, error: "Duration is too long (max 10 years). Use a permanent ban instead." };
  return { ok: true, value: minutes };
}

export const addMinutes = (from: Date, minutes: number) => new Date(from.getTime() + minutes * 60_000);

/** 135 -> "2h 15m", 1500 -> "1d 1h". */
export function formatMinutes(total: number | null | undefined): string {
  const m = Math.max(0, Math.floor(Number(total) || 0));
  if (m < 1) return "0m";
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return mm ? `${h}h ${mm}m` : `${h}h`;
  return `${mm}m`;
}

export const isExpired = (expiresAt: Date | string | null | undefined, now = new Date()) =>
  !!expiresAt && new Date(expiresAt).getTime() <= now.getTime();

/** Parses ?page=; always returns an integer from 1 to max. */
export function parsePage(raw: unknown, max = 100000): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, Math.max(1, max)) : 1;
}

/**
 * A staff member may not punish a player whose website account is staff at the same level or higher.
 * `targetRole` is the role of the User linked to the Minecraft player (undefined if not linked).
 */
export function canActOn(actorRole: Role, targetRole: Role | undefined): boolean {
  if (!targetRole || !isStaff(targetRole)) return true;
  return !hasRole(targetRole, actorRole);
}

/** Maps a web punishment type to the bridge command described in docs/BRIDGE_API.md. */
export function bridgeCommandFor(
  type: string,
  p: { uuid: string; name: string; reason: string; expiresAt?: Date | null; ip?: string | null }
): { type: "ban" | "mute" | "kick" | "warn"; payload: Record<string, unknown> } | null {
  const base = { uuid: p.uuid, name: p.name, reason: p.reason };
  switch (type) {
    case "ban":
      return { type: "ban", payload: base };
    case "tempban":
      return p.expiresAt ? { type: "ban", payload: { ...base, expiresAt: p.expiresAt.toISOString() } } : null;
    case "ipban":
      return p.ip ? { type: "ban", payload: { ...base, ip: p.ip } } : null;
    case "mute":
      return { type: "mute", payload: base };
    case "tempmute":
      return p.expiresAt ? { type: "mute", payload: { ...base, expiresAt: p.expiresAt.toISOString() } } : null;
    case "kick":
      return { type: "kick", payload: base };
    case "warn":
      return { type: "warn", payload: base };
    default:
      return null;
  }
}
