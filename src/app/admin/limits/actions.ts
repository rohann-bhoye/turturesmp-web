"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/server/db";
import { Rank } from "@/server/models/Rank";
import { requireRole } from "@/server/guard";
import { audit } from "@/server/audit";
import { queueCommand } from "@/server/bridge-queue";
import { LIMITS, MAX_LIMIT, BASE_HOMES, isLimitNode } from "./limits-def";

const num = (v: FormDataEntryValue | null): number | null | "bad" => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= MAX_LIMIT ? n : "bad";
};

export async function saveLimits(formData: FormData) {
  const user = await requireRole("admin");
  await connectDB();
  const ranks = await Rank.find().sort({ weight: 1 });
  let changed = 0;

  for (const r of ranks) {
    const values: Record<string, number | null> = {};
    for (const l of LIMITS) {
      const v = num(formData.get(`${l.id}_${r.key}`));
      if (v === "bad") redirect(`/admin/limits?error=${encodeURIComponent(`${r.displayName}: use a whole number from 1 to ${MAX_LIMIT}, or leave empty.`)}`);
      values[l.id] = v;
    }

    const before: string[] = r.permissions ?? [];
    // Only the nodes this page owns are rebuilt; every other permission of the rank is kept.
    const next = before.filter((n: string) => !isLimitNode(n, r.key));
    // The default rank carries the base node, so every rank that inherits from it can have several homes.
    if (values.homes) next.push(r.isDefault ? BASE_HOMES : `${BASE_HOMES}.${r.key}`);
    for (const l of LIMITS) if (l.prefix && values[l.id]) next.push(`${l.prefix}${values[l.id]}`);

    r.limits = Object.fromEntries(LIMITS.map((l) => [l.id, values[l.id] ?? undefined]));
    const same = next.length === before.length && next.every((n) => before.includes(n));
    if (same) { await r.save(); continue; }

    r.permissions = next;
    r.syncedAt = undefined;
    await r.save();
    await queueCommand(
      "rank_define",
      { key: r.key, displayName: r.displayName, prefix: r.prefix, suffix: r.suffix, weight: r.weight, inherits: r.inherits, permissions: next },
      { createdBy: user.username }
    );
    changed++;
  }
  await audit(user, "rank.limits", "limits", { changed, name: `${changed} rank(s) updated` });
  revalidatePath("/admin/limits");
  redirect(`/admin/limits?saved=${changed}`);
}
