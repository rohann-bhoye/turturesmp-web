// Pure helpers for the Ranks & Tags admin. No database or Next imports, so they are easy to test
// (scripts/test-ranks-util.ts) and safe to use in client components.

// ---------- keys and colours ----------
export const KEY_RE = /^[a-z0-9_]{1,32}$/;
export const isValidKey = (v: unknown): v is string => typeof v === "string" && KEY_RE.test(v);

export const COLOR_RE = /^#[0-9a-f]{6}$/i;
export const isValidColor = (v: unknown): v is string => typeof v === "string" && COLOR_RE.test(v);

export const DISCORD_ID_RE = /^\d{17,20}$/;

// ---------- permissions ----------
// One node per line. Charset [a-z0-9_.*:-], optional leading "-" (negation). Blank lines are ignored.
const NODE_RE = /^-?[a-z0-9_.*:-]+$/;
export const isValidPermissionNode = (n: string) => NODE_RE.test(n) && n.replace(/^-/, "").length > 0 && !n.startsWith("--");

export type ParsedPermissions = { nodes: string[]; errors: string[] };

export function parsePermissions(text: string, max = 500): ParsedPermissions {
  const nodes: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = String(text ?? "").split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (!isValidPermissionNode(line)) {
      errors.push(`Line ${i + 1}: "${line.slice(0, 40)}" is not a valid permission node`);
      return;
    }
    if (seen.has(line)) return;
    seen.add(line);
    nodes.push(line);
  });
  if (nodes.length > max) errors.push(`At most ${max} permission nodes are allowed`);
  return { nodes, errors };
}

// ---------- Minecraft "&" colour codes ----------
export type McSpan = {
  text: string;
  color?: string; // CSS colour, undefined = inherit
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
};

export const MC_COLORS: Record<string, string> = {
  "0": "#000000", "1": "#0000aa", "2": "#00aa00", "3": "#00aaaa",
  "4": "#aa0000", "5": "#aa00aa", "6": "#ffaa00", "7": "#aaaaaa",
  "8": "#555555", "9": "#5555ff", a: "#55ff55", b: "#55ffff",
  c: "#ff5555", d: "#ff55ff", e: "#ffff55", f: "#ffffff",
};

// Converts "&6[&eGold&6] &f" into styled segments. Supports &0-&f, &l &o &n &m (formatting),
// &r (reset), &k (dropped) and &#rrggbb. A colour code resets formatting, as in game.
// A "&" that is not followed by a known code is kept as text.
export function mcToSpans(input: string): McSpan[] {
  const s = String(input ?? "");
  const spans: McSpan[] = [];
  let style: Omit<McSpan, "text"> = {};
  let buf = "";
  const flush = () => {
    if (buf) spans.push({ text: buf, ...style });
    buf = "";
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "&" && i + 1 < s.length) {
      const next = s[i + 1];
      const hex = s.slice(i + 1, i + 8);
      if (next === "#" && /^#[0-9a-fA-F]{6}$/.test(hex)) {
        flush();
        style = { color: hex.toLowerCase() };
        i += 7;
        continue;
      }
      const code = next.toLowerCase();
      if (code in MC_COLORS) {
        flush();
        style = { color: MC_COLORS[code] };
        i += 1;
        continue;
      }
      if ("lonmkr".includes(code)) {
        flush();
        if (code === "r") style = {};
        else if (code === "l") style = { ...style, bold: true };
        else if (code === "o") style = { ...style, italic: true };
        else if (code === "n") style = { ...style, underline: true };
        else if (code === "m") style = { ...style, strike: true };
        // "k" (obfuscated) has no static preview and is dropped.
        i += 1;
        continue;
      }
    }
    buf += ch;
  }
  flush();
  return spans;
}

// Same input with all codes removed (what a plain-text client would show).
export const stripMcCodes = (input: string) => mcToSpans(input).map((s) => s.text).join("");

// ---------- inheritance ----------
// `graph` maps rank key -> keys it inherits. Returns the cycle path (e.g. ["a","b","a"]) that would exist
// if `key` inherited `inherits`, or null when it is fine. Unknown parents are ignored here (checked elsewhere).
export function findInheritCycle(key: string, inherits: string[], graph: Record<string, string[]>): string[] | null {
  const g: Record<string, string[]> = { ...graph, [key]: inherits };
  const path: string[] = [];
  const onPath = new Set<string>();
  const done = new Set<string>();
  const visit = (k: string): string[] | null => {
    if (onPath.has(k)) return [...path.slice(path.indexOf(k)), k];
    if (done.has(k)) return null;
    onPath.add(k);
    path.push(k);
    for (const p of g[k] ?? []) {
      const c = visit(p);
      if (c) return c;
    }
    path.pop();
    onPath.delete(k);
    done.add(k);
    return null;
  };
  return visit(key);
}

// ---------- misc ----------
// Whole number of days between min and max, or null when invalid (empty string included).
export function parseDays(v: unknown, min = 1, max = 3650): number | null {
  const s = String(v ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
