"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/server/db";
import { Player } from "@/server/models/Player";
import { PUNISH_TYPES } from "@/server/models/Punishment";
import { requireRole } from "@/server/guard";
import { audit } from "@/server/audit";
import { queueCommand } from "@/server/bridge-queue";
import { MAX_NOTE, isTempType, isValidUuid, parseDuration, validateMessage, validateReason } from "@/server/players-util";
import { issuePunishment } from "./punish-core";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

function back(uuid: string, q: string): never {
  revalidatePath(`/admin/players/${uuid}`);
  redirect(`/admin/players/${encodeURIComponent(uuid)}?${q}`);
}
const fail = (uuid: string, msg: string): never => back(uuid, `error=${encodeURIComponent(msg)}`);

async function loadTarget(f: FormData) {
  const uuid = str(f, "uuid");
  if (!isValidUuid(uuid)) redirect("/admin/players?error=Invalid+player");
  await connectDB();
  const player = await Player.findOne({ uuid });
  if (!player) redirect("/admin/players?error=Player+not+found");
  return { uuid, player };
}

export async function punishPlayer(formData: FormData) {
  const me = await requireRole("mod");
  const { uuid, player } = await loadTarget(formData);

  const type = str(formData, "type");
  if (!(PUNISH_TYPES as readonly string[]).includes(type)) return fail(uuid, "Unknown punishment type.");
  const reason = validateReason(formData.get("reason"));
  if (!reason.ok) return fail(uuid, reason.error);

  let durationMinutes: number | undefined;
  if (isTempType(type)) {
    const d = parseDuration(formData.get("amount"), formData.get("unit"));
    if (!d.ok) return fail(uuid, d.error);
    durationMinutes = d.value;
  }

  const res = await issuePunishment(me, { uuid: player.uuid, name: player.name, lastIp: player.lastIp }, { type, reason: reason.value, durationMinutes });
  if (!res.ok) return fail(uuid, res.error);
  return back(uuid, "saved=punished");
}

export async function addNote(formData: FormData) {
  const me = await requireRole("mod");
  const { uuid, player } = await loadTarget(formData);
  const text = validateMessage(formData.get("text"), 1, MAX_NOTE, "Note");
  if (!text.ok) return fail(uuid, text.error);

  await Player.updateOne({ uuid }, { $push: { notes: { $each: [{ by: me.username, text: text.value, at: new Date() }], $slice: -200 } } });
  await audit(me, "player.note", player.name, { uuid, length: text.value.length });
  return back(uuid, "saved=note");
}

export async function setWhitelist(formData: FormData) {
  const me = await requireRole("mod");
  const { uuid, player } = await loadTarget(formData);
  const on = str(formData, "on") === "1";

  let commandId: string | null = null;
  try {
    commandId = await queueCommand(on ? "whitelist_add" : "whitelist_remove", { uuid: player.uuid, name: player.name }, { createdBy: me.username });
  } catch (e) {
    console.error("queueCommand failed", e);
  }
  if (!commandId) return fail(uuid, "Could not queue the whitelist change for the server.");
  await Player.updateOne({ uuid }, { $set: { whitelisted: on } });
  await audit(me, on ? "player.whitelist_add" : "player.whitelist_remove", player.name, { uuid, commandId });
  return back(uuid, on ? "saved=whitelisted" : "saved=unwhitelisted");
}
