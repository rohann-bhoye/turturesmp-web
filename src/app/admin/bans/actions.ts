"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/server/db";
import { Appeal } from "@/server/models/Punishment";
import { requireRole } from "@/server/guard";
import { audit } from "@/server/audit";
import { isObjectId, validateMessage, validateReason } from "@/server/players-util";
import { revokePunishment } from "../players/punish-core";

const TABS = ["active", "history", "appeals"];
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

function go(tab: string, q: string): never {
  revalidatePath("/admin/bans");
  redirect(`/admin/bans?tab=${tab}&${q}`);
}
const tabOf = (f: FormData) => (TABS.includes(str(f, "tab")) ? str(f, "tab") : "active");
const fail = (tab: string, msg: string): never => go(tab, `error=${encodeURIComponent(msg)}`);

export async function revokeAction(formData: FormData) {
  const me = await requireRole("mod");
  const tab = tabOf(formData);
  const id = str(formData, "id");
  if (!isObjectId(id)) return fail(tab, "Invalid request.");
  const reason = validateReason(formData.get("reason"));
  if (!reason.ok) return fail(tab, reason.error);

  const res = await revokePunishment(me, id, reason.value);
  if (!res.ok) return fail(tab, res.error);
  return go(tab, "saved=revoked");
}

export async function reviewAppeal(formData: FormData) {
  const me = await requireRole("mod");
  const id = str(formData, "id");
  const decision = str(formData, "decision");
  if (!isObjectId(id) || (decision !== "accept" && decision !== "deny")) return fail("appeals", "Invalid request.");

  const note = validateMessage(formData.get("note"), decision === "deny" ? 3 : 0, 500, decision === "deny" ? "A note explaining the decision" : "Note");
  if (!note.ok) return fail("appeals", note.error);

  await connectDB();
  // Claim the appeal first, so two moderators cannot both process it.
  const appeal = await Appeal.findOneAndUpdate(
    { _id: id, status: "open" },
    { $set: { status: decision === "accept" ? "accepted" : "denied", reviewedBy: me.username, reviewNote: note.value, reviewedAt: new Date() } },
    { new: true }
  );
  if (!appeal) return fail("appeals", "That appeal was already handled.");

  if (decision === "accept") {
    const reason = `Appeal accepted${note.value ? `: ${note.value}` : ""}`.slice(0, 200);
    const res = await revokePunishment(me, String(appeal.punishmentId), reason, "appeal.accept.revoke");
    await audit(me, "appeal.accept", appeal.playerName, { appealId: id, punishmentId: String(appeal.punishmentId), note: note.value, revoked: res.ok });
    // "not active any more" simply means it was already lifted; anything else is worth showing.
    if (!res.ok && !res.error.includes("not active")) return fail("appeals", `Appeal accepted. ${res.error}`);
    return go("appeals", "saved=accepted");
  }

  await audit(me, "appeal.deny", appeal.playerName, { appealId: id, punishmentId: String(appeal.punishmentId), note: note.value });
  return go("appeals", "saved=denied");
}
