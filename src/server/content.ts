import { faq as dFaq, news as dNews, punishments as dPunishments, rules as dRules } from "@/data";
import { connectDB } from "./db";
import { SiteContent } from "./models/SiteContent";
import { normalizeItem, sectionDef, type Item, type SectionKey } from "./content-schema";

// What the public pages show when nothing was saved in the admin yet.
// Team, vote and gallery start empty on purpose: the old placeholder names and fake rewards must never appear.
const DEFAULTS: Record<SectionKey, () => Item[]> = {
  team: () => [],
  vote: () => [],
  gallery: () => [],
  rules: () => dRules.map((r) => ({ t: r.t, d: r.d })),
  punishments: () => dPunishments.map((label) => ({ label })),
  faq: () => dFaq.map((f) => ({ q: f.q, a: f.a })),
  news: () => dNews.map((n) => ({ t: n.t, tag: n.tag, date: n.date, d: n.d })),
};

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** The saved items of a section, or null when the admin never saved this section. */
async function readSaved(key: SectionKey): Promise<Item[] | null> {
  const def = sectionDef(key);
  if (!def || !process.env.MONGODB_URI) return null;
  await connectDB();
  const doc = await SiteContent.findOne({ key }).lean();
  if (!doc) return null;
  return (doc.items ?? []).map((raw: unknown) => normalizeItem(def, raw)).filter((x: Item | null): x is Item => x !== null);
}

/** For the public pages: saved content, else the defaults. Never throws (a database problem falls back to defaults). */
export async function getSection(key: SectionKey): Promise<Item[]> {
  try {
    const saved = await withTimeout(readSaved(key), 6000);
    return saved ?? DEFAULTS[key]();
  } catch (e) {
    console.error(`content: could not read "${key}"`, e);
    return DEFAULTS[key]();
  }
}

/** For the admin: also says whether the list is customised or still the built-in default. */
export async function getSectionForAdmin(key: SectionKey): Promise<{ items: Item[]; custom: boolean }> {
  const saved = await readSaved(key);
  return saved ? { items: saved, custom: true } : { items: DEFAULTS[key](), custom: false };
}
