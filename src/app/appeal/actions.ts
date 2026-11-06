"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/server/db";
import { Appeal, Punishment } from "@/server/models/Punishment";
import { User } from "@/server/models/User";
import { getCurrentUser } from "@/server/session";
import { ACTIVE_TYPES, MAX_APPEAL, isObjectId, validateMessage } from "@/server/players-util";

const fail = (msg: string): never => redirect(`/appeal?error=${encodeURIComponent(msg)}`);

export async function submitAppeal(formData: FormData) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/appeal");

  const id = String(formData.get("punishmentId") ?? "");
  if (!isObjectId(id)) return fail("Pick a punishment to appeal.");
  const msg = validateMessage(formData.get("message"), 20, MAX_APPEAL, "Your message");
  if (!msg.ok) return fail(msg.error);

  await connectDB();
  const account = await User.findById(user.id).select("minecraft").lean();
  const mcName = account?.minecraft?.name;
  const mcUuid = account?.minecraft?.uuid;
  if (!mcName && !mcUuid) return fail("Link your Minecraft name to your account first, then you can appeal.");

  const p = await Punishment.findById(id).lean();
  const mine = !!p && ((mcUuid && p.playerUuid === mcUuid) || (!!mcName && p.playerName.toLowerCase() === mcName.toLowerCase()));
  // Same message for "missing" and "not yours" so punishment ids cannot be probed.
  if (!p || !mine || !p.active || !(ACTIVE_TYPES as readonly string[]).includes(p.type)) return fail("You can only appeal your own active bans and mutes.");

  const existing = await Appeal.exists({ punishmentId: p._id, status: "open" });
  if (existing) return fail("You already have an open appeal for this punishment. Please wait for staff to review it.");

  await Appeal.create({ punishmentId: p._id, playerName: p.playerName, userId: user.id, message: msg.value, status: "open" });
  revalidatePath("/appeal");
  revalidatePath("/admin/bans");
  redirect("/appeal?saved=1");
}
