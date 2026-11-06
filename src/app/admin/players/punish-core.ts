import "server-only";
import { connectDB } from "@/server/db";
import { Player } from "@/server/models/Player";
import { Punishment } from "@/server/models/Punishment";
import { ServerSettings } from "@/server/models/ServerSettings";
import { User } from "@/server/models/User";
import { queueCommand } from "@/server/bridge-queue";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/session";
import type { Role } from "@/server/roles";
import { ACTIVE_TYPES, BAN_TYPES, MUTE_TYPES, addMinutes, bridgeCommandFor, canActOn, escapeRegex, isBanType, isTempType } from "@/server/players-util";

export type Result = { ok: true; message: string } | { ok: false; error: string };

/** Lazy expiry: tempbans / tempmutes whose time has passed are no longer active. */
export async function expireStale() {
  await connectDB();
  const now = new Date();
  await Punishment.updateMany(
    { active: true, expiresAt: { $exists: true, $ne: null, $lte: now } },
    { $set: { active: false, revokedBy: "System", revokedAt: now, revokeReason: "Expired" } }
  );
}

export async function defaultReason() {
  await connectDB();
  const s = await ServerSettings.findOne({ key: "main" }).select("access.defaultBanReason").lean();
  return s?.access?.defaultBanReason || "Breaking server rules";
}

/** Highest role among all linked accounts, so a decoy account with a low role cannot hide a staff link. */
export async function highestLinkedRole(player: { uuid: string; name: string }): Promise<Role | undefined> {
  await connectDB();
  const users = await User.find({
    $or: [{ "minecraft.uuid": player.uuid }, { "minecraft.name": { $regex: `^${escapeRegex(player.name)}$`, $options: "i" } }],
  })
    .select("role")
    .lean();
  const order: Role[] = ["user", "viewer", "mod", "admin", "owner"];
  let best: Role | undefined;
  for (const u of users) {
    const r = u.role as Role;
    if (!best || order.indexOf(r) > order.indexOf(best)) best = r;
  }
  return best;
}

type PlayerLike = { uuid: string; name: string; lastIp?: string | null };

export async function issuePunishment(
  actor: SessionUser,
  player: PlayerLike,
  input: { type: string; reason: string; durationMinutes?: number }
): Promise<Result> {
  const { type, reason } = input;
  await expireStale();

  const targetRole = await highestLinkedRole(player);
  if (!canActOn(actor.role, targetRole)) {
    return { ok: false, error: "You cannot punish a staff member at or above your own role." };
  }

  const isBan = isBanType(type);
  const isMute = (MUTE_TYPES as readonly string[]).includes(type);
  if (isBan || isMute) {
    const group = isBan ? BAN_TYPES : MUTE_TYPES;
    const dupe = await Punishment.exists({ playerUuid: player.uuid, active: true, type: { $in: group } });
    if (dupe) return { ok: false, error: `${player.name} already has an active ${isBan ? "ban" : "mute"}. Revoke it first.` };
  }

  let expiresAt: Date | undefined;
  if (isTempType(type)) {
    if (!input.durationMinutes) return { ok: false, error: "A duration is required." };
    expiresAt = addMinutes(new Date(), input.durationMinutes);
  }
  const ip = type === "ipban" ? player.lastIp || undefined : undefined;
  if (type === "ipban" && !ip) return { ok: false, error: "No IP address is known for this player, so an IP ban is not possible." };

  const cmd = bridgeCommandFor(type, { uuid: player.uuid, name: player.name, reason, expiresAt, ip });
  if (!cmd) return { ok: false, error: "Unknown punishment type." };

  const instant = type === "kick" || type === "warn";
  const doc = await Punishment.create({
    playerUuid: player.uuid,
    playerName: player.name,
    type,
    reason,
    issuedBy: actor.username,
    issuedById: actor.id,
    source: "web",
    ip,
    expiresAt,
    active: !instant,
  });

  let commandId: string | null = null;
  try {
    commandId = await queueCommand(cmd.type, cmd.payload, { createdBy: actor.username });
  } catch (e) {
    console.error("queueCommand failed", e);
  }
  await audit(actor, `punish.${type}`, player.name, {
    uuid: player.uuid,
    reason,
    expiresAt: expiresAt?.toISOString(),
    ipban: type === "ipban",
    punishmentId: String(doc._id),
    commandId,
    queueFailed: commandId ? undefined : true,
  });
  if (!commandId) {
    return { ok: false, error: "The punishment was recorded, but the server command could not be queued. Check the database and try again." };
  }
  return { ok: true, message: `${type} applied to ${player.name}.` };
}

/** Marks a punishment as revoked and queues unban / unmute. Used by the revoke button and by accepted appeals. */
export async function revokePunishment(actor: SessionUser, id: string, reason: string, auditAction = "punish.revoke"): Promise<Result> {
  await connectDB();
  const now = new Date();
  const p = await Punishment.findOneAndUpdate(
    { _id: id, active: true, type: { $in: [...ACTIVE_TYPES] } },
    { $set: { active: false, revokedBy: actor.username, revokedAt: now, revokeReason: reason } },
    { new: true }
  );
  if (!p) return { ok: false, error: "That punishment is not active any more." };

  const cmdType = isBanType(p.type) ? "unban" : "unmute";
  let commandId: string | null = null;
  try {
    commandId = await queueCommand(cmdType, { uuid: p.playerUuid, name: p.playerName }, { createdBy: actor.username });
  } catch (e) {
    console.error("queueCommand failed", e);
  }
  await audit(actor, auditAction, p.playerName, {
    uuid: p.playerUuid,
    punishmentId: String(p._id),
    type: p.type,
    reason,
    commandId,
    queueFailed: commandId ? undefined : true,
  });
  if (!commandId) return { ok: false, error: "Revoked on the website, but the server command could not be queued." };
  return { ok: true, message: `${p.playerName} was ${cmdType === "unban" ? "unbanned" : "unmuted"}.` };
}

export async function findPlayer(uuid: string) {
  await connectDB();
  return Player.findOne({ uuid });
}
