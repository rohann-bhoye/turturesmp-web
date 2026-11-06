import { Punishment, PUNISH_TYPES } from "@/server/models";
import { bad, handle, ip, isObj, isoDate, json, playerName, str, uuid } from "../_util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PunishType = (typeof PUNISH_TYPES)[number];

export async function POST(req: Request) {
  return handle(req, async (body) => {
    if (!isObj(body)) return bad("Body must be a JSON object.");
    if (body.type !== "punishment") return bad("Unknown event type.");
    const p = body.punishment;
    if (!isObj(p)) return bad("'punishment' must be an object.");

    const playerUuid = uuid(p.uuid);
    const name = playerName(p.name);
    if (!playerUuid || !name) return bad("Punishment needs a valid uuid and name.");
    // In-game /tsmp unban and /tsmp unmute: revoke the matching active punishments (mirror only, nothing is queued).
    if (p.type === "unban" || p.type === "unmute") {
      const kinds = p.type === "unban" ? ["ban", "tempban", "ipban"] : ["mute", "tempmute"];
      await Punishment.updateMany(
        { playerUuid, active: true, type: { $in: kinds } },
        { $set: { active: false, revokedBy: str(p.issuedBy, 40) || "Console", revokedAt: new Date(), revokeReason: str(p.reason, 500) || "Revoked in game" } }
      );
      return json({ ok: true });
    }
    if (typeof p.type !== "string" || !(PUNISH_TYPES as readonly string[]).includes(p.type)) return bad("Unknown punishment type.");

    const expiresAt = isoDate(p.expiresAt);
    if (expiresAt === null) return bad("'expiresAt' must be an ISO date.");
    const addr = p.ip === undefined || p.ip === null || p.ip === "" ? undefined : ip(p.ip);
    if (p.ip && !addr) return bad("'ip' is not a valid IP address.");

    // A plain ban/mute with an expiry is the temporary variant.
    let type = p.type as PunishType;
    if (expiresAt && type === "ban") type = "tempban";
    if (expiresAt && type === "mute") type = "tempmute";

    const reason = str(p.reason, 500) || "No reason given";
    const issuedBy = str(p.issuedBy, 40) || "Console";

    // The plugin retries on network errors: ignore an identical punishment from the last minute.
    const dup = await Punishment.exists({
      playerUuid, type, reason, issuedBy, source: "ingame",
      createdAt: { $gte: new Date(Date.now() - 60_000) },
    });
    if (dup) return json({ ok: true });

    // Mirror only: no BridgeCommand is queued, the action already happened in game.
    await Punishment.create({
      playerUuid,
      playerName: name,
      type,
      reason,
      issuedBy,
      source: "ingame",
      ip: addr,
      expiresAt,
      active: type !== "kick" && !(expiresAt && expiresAt.getTime() <= Date.now()),
    });
    return json({ ok: true });
  });
}
