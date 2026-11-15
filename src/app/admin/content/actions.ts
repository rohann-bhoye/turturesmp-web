"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/server/db";
import { SiteContent } from "@/server/models/SiteContent";
import { requireRole } from "@/server/guard";
import { audit } from "@/server/audit";
import { getSectionForAdmin } from "@/server/content";
import { cleanItem, isSectionKey, moveInList, sectionDef, type Item, type SectionKey } from "@/server/content-schema";
import type { SessionUser } from "@/server/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const to = (key: string, q: string): string => `/admin/content?tab=${key}&${q}`;

function sectionOf(f: FormData) {
  const key = str(f, "section");
  if (!isSectionKey(key)) redirect("/admin/content?error=Unknown+section");
  return { key: key as SectionKey, def: sectionDef(key)! };
}

/** Parses "3" into an index inside the list, or null. */
const indexOf = (v: string, len: number) => {
  if (!/^\d{1,4}$/.test(v)) return null;
  const n = Number(v);
  return n < len ? n : null;
};

async function persist(user: SessionUser, key: SectionKey, items: Item[], action: string, detail?: string) {
  await connectDB();
  await SiteContent.findOneAndUpdate({ key }, { $set: { items, updatedBy: user.username } }, { upsert: true });
  await audit(user, `content.${action}`, key, { count: items.length, ...(detail ? { name: detail } : {}) });
  const def = sectionDef(key)!;
  for (const p of def.pages) revalidatePath(p);
  revalidatePath("/admin/content");
}

export async function saveItem(formData: FormData) {
  const user = await requireRole("admin");
  const { key, def } = sectionOf(formData);
  const fail = (msg: string, edit?: string) => redirect(to(key, `error=${encodeURIComponent(msg)}${edit ? `&edit=${edit}` : ""}`));

  const { items } = await getSectionForAdmin(key);
  const rawIndex = str(formData, "index");
  const adding = rawIndex === "";
  const index = adding ? null : indexOf(rawIndex, items.length);
  if (!adding && index === null) return fail("That item no longer exists. Reload the page.");

  const res = cleanItem(def, (name) => formData.get(name));
  if (!res.ok) return fail(res.error, adding ? "new" : String(index));
  if (adding && items.length >= def.max) return fail(`You can have at most ${def.max} items here.`);

  const next = [...items];
  if (adding) next.push(res.item);
  else next[index!] = res.item;
  await persist(user, key, next, adding ? "add" : "edit", res.item[def.title]);
  redirect(to(key, "saved=1"));
}

export async function deleteItem(formData: FormData) {
  const user = await requireRole("admin");
  const { key, def } = sectionOf(formData);
  const { items } = await getSectionForAdmin(key);
  const index = indexOf(str(formData, "index"), items.length);
  if (index === null) redirect(to(key, "error=That+item+no+longer+exists.+Reload+the+page."));
  const gone = items[index];
  await persist(user, key, items.filter((_, i) => i !== index), "delete", gone[def.title]);
  redirect(to(key, "saved=deleted"));
}

export async function moveItem(formData: FormData) {
  const user = await requireRole("admin");
  const { key } = sectionOf(formData);
  const dir = str(formData, "dir") === "up" ? -1 : 1;
  const { items } = await getSectionForAdmin(key);
  const index = indexOf(str(formData, "index"), items.length);
  if (index === null) redirect(to(key, "error=That+item+no+longer+exists.+Reload+the+page."));
  const next = moveInList(items, index, dir);
  if (next !== items) await persist(user, key, next, "move");
  redirect(to(key, "saved=moved"));
}

/** Throws the saved list away: the public page goes back to the built-in default content. */
export async function resetSection(formData: FormData) {
  const user = await requireRole("admin");
  const { key, def } = sectionOf(formData);
  if (str(formData, "sure") !== "on") redirect(to(key, "error=Tick+the+box+to+confirm+the+reset."));
  await connectDB();
  await SiteContent.deleteOne({ key });
  await audit(user, "content.reset", key);
  for (const p of def.pages) revalidatePath(p);
  revalidatePath("/admin/content");
  redirect(to(key, "saved=reset"));
}
