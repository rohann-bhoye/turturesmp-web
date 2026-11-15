// Editable public-page content: what each section holds and how an item is validated.
// Pure (no database or Next imports) so the admin UI, the public pages and scripts/test-content-schema.ts can all use it.

export type SectionKey = "team" | "vote" | "rules" | "punishments" | "faq" | "news" | "gallery";
export type FieldKind = "text" | "textarea" | "url" | "image" | "color";

export type FieldDef = {
  name: string;
  label: string;
  kind: FieldKind;
  max: number;
  required?: boolean;
  placeholder?: string;
  help?: string;
};

export type SectionDef = {
  key: SectionKey;
  label: string;
  icon: string;
  blurb: string;
  /** Public pages that show this section (re-rendered right after a save). */
  pages: string[];
  max: number;
  fields: FieldDef[];
  /** Field shown as the card title and the field shown under it. */
  title: string;
  sub?: string;
  /** Fallback colour for a "color" field that was left empty. */
  defaultColor?: string;
};

export type Item = Record<string, string>;

export const SECTIONS: SectionDef[] = [
  {
    key: "team", label: "Team", icon: "👥", pages: ["/team"], max: 24, title: "name", sub: "role", defaultColor: "#55ffff",
    blurb: "The staff shown on the Team page. Use the exact Minecraft name so the head shows.",
    fields: [
      { name: "name", label: "Minecraft name", kind: "text", max: 32, required: true, placeholder: "Rohann07" },
      { name: "role", label: "Role", kind: "text", max: 32, required: true, placeholder: "Owner" },
      { name: "color", label: "Role colour", kind: "color", max: 7 },
      { name: "bio", label: "Short bio", kind: "textarea", max: 200, placeholder: "Founder of Turture SMP." },
    ],
  },
  {
    key: "vote", label: "Vote sites", icon: "🗳️", pages: ["/vote"], max: 12, title: "name", sub: "reward",
    blurb: "Voting sites players can use. Only list a reward that is really given in game.",
    fields: [
      { name: "name", label: "Site name", kind: "text", max: 60, required: true, placeholder: "MinecraftServers.org" },
      { name: "url", label: "Your server's voting link", kind: "url", max: 300, required: true, placeholder: "https://minecraftservers.org/server/…" },
      { name: "reward", label: "Reward (optional)", kind: "text", max: 80, placeholder: "1 Vote Key", help: "Leave empty if there is no reward yet." },
    ],
  },
  {
    key: "rules", label: "Rules", icon: "📜", pages: ["/rules", "/"], max: 30, title: "t", sub: "d",
    blurb: "The server rules. The first five also appear on the home page.",
    fields: [
      { name: "t", label: "Rule", kind: "text", max: 60, required: true, placeholder: "Be respectful" },
      { name: "d", label: "Explanation", kind: "textarea", max: 300, required: true, placeholder: "No harassment, hate speech or threats." },
    ],
  },
  {
    key: "punishments", label: "Punishments", icon: "🔨", pages: ["/rules"], max: 10, title: "label",
    blurb: "The punishment ladder on the Rules page, from mildest to strictest.",
    fields: [{ name: "label", label: "Step", kind: "text", max: 80, required: true, placeholder: "Temp ban (1d – 30d)" }],
  },
  {
    key: "faq", label: "FAQ", icon: "❓", pages: ["/"], max: 20, title: "q", sub: "a",
    blurb: "Questions and answers on the home page.",
    fields: [
      { name: "q", label: "Question", kind: "text", max: 140, required: true, placeholder: "How do I protect my base?" },
      { name: "a", label: "Answer", kind: "textarea", max: 500, required: true },
    ],
  },
  {
    key: "news", label: "News", icon: "📰", pages: ["/"], max: 12, title: "t", sub: "d",
    blurb: "Announcements on the home page. Newest first: put the latest at the top.",
    fields: [
      { name: "t", label: "Title", kind: "text", max: 90, required: true, placeholder: "Friday build contest" },
      { name: "tag", label: "Label", kind: "text", max: 20, required: true, placeholder: "Event" },
      { name: "date", label: "Date or period", kind: "text", max: 30, required: true, placeholder: "Every Friday" },
      { name: "d", label: "Details", kind: "textarea", max: 300, required: true },
    ],
  },
  {
    key: "gallery", label: "Gallery", icon: "🖼️", pages: ["/gallery"], max: 36, title: "caption", sub: "src",
    blurb: "Screenshots. Paste a direct image link (https://…png/jpg/webp) or a file you put in /public/gallery.",
    fields: [
      { name: "src", label: "Image link", kind: "image", max: 400, required: true, placeholder: "https://i.imgur.com/….png", help: "Discord image links stop working after a while. Imgur or your own hosting is safer." },
      { name: "caption", label: "Caption", kind: "text", max: 80, required: true, placeholder: "Spawn Town" },
    ],
  },
];

export const sectionDef = (key: unknown): SectionDef | undefined => SECTIONS.find((s) => s.key === key);
export const isSectionKey = (v: unknown): v is SectionKey => !!sectionDef(v);

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Trims, strips control characters and caps the length. Textareas keep their line breaks. */
export function cleanText(v: unknown, max: number, multiline = false): string {
  let s = String(v ?? "").replace(/\r\n?/g, "\n").replace(CONTROL, "");
  if (!multiline) s = s.replace(/\n+/g, " ");
  return s.trim().slice(0, max);
}

export const COLOR_RE = /^#[0-9a-f]{6}$/i;

export function isHttpsUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !!u.hostname;
  } catch {
    return false;
  }
}

/** A gallery image is an https link or a file inside /public/gallery (no path tricks). */
export function isImageSrc(v: string): boolean {
  if (isHttpsUrl(v)) return true;
  return /^\/gallery\/[A-Za-z0-9._-]+$/.test(v) && !v.includes("..");
}

/** Validates one item from a form. Returns the cleaned item (only the section's own fields) or an error text. */
export function cleanItem(def: SectionDef, get: (name: string) => unknown): { ok: true; item: Item } | { ok: false; error: string } {
  const item: Item = {};
  for (const f of def.fields) {
    let v = cleanText(get(f.name), f.max, f.kind === "textarea");
    if (f.kind === "color") {
      if (!v) v = def.defaultColor ?? "#55e03a";
      if (!COLOR_RE.test(v)) return { ok: false, error: `${f.label} must be a colour like #ffaa00.` };
      v = v.toLowerCase();
    } else if (f.required && !v) {
      return { ok: false, error: `${f.label} is required.` };
    } else if (v && f.kind === "url" && !isHttpsUrl(v)) {
      return { ok: false, error: `${f.label} must be a full link starting with https://` };
    } else if (v && f.kind === "image" && !isImageSrc(v)) {
      return { ok: false, error: `${f.label} must be an https:// link or a /gallery/ file name.` };
    }
    item[f.name] = v;
  }
  return { ok: true, item };
}

/** Keeps only the section's own fields, as strings (protects pages from odd data in the database). */
export function normalizeItem(def: SectionDef, raw: unknown): Item | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const item: Item = {};
  for (const f of def.fields) item[f.name] = cleanText(r[f.name], f.max, f.kind === "textarea");
  const must = def.fields.filter((f) => f.required);
  return must.every((f) => item[f.name]) ? item : null;
}

/** Moves item `i` one step up (-1) or down (+1). Out-of-range moves return the list unchanged. */
export function moveInList<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (!Number.isInteger(i) || i < 0 || i >= list.length || j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
