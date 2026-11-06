import { Player } from "@/server/models";
import { bad, edition, handle, ip, isObj, json, num, playerName, str, uuid } from "../../_util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PLAYERS = 500;

export async function POST(req: Request) {
  return handle(req, async (body) => {
    if (!isObj(body) || !Array.isArray(body.players)) return bad("'players' must be an array.");
    if (body.players.length > MAX_PLAYERS) return bad(`At most ${MAX_PLAYERS} players per request.`);

    const now = new Date();
    const valid = new Map<string, Record<string, unknown>>();
    for (const p of body.players) {
      if (!isObj(p)) continue;
      const id = uuid(p.uuid);
      const name = playerName(p.name);
      if (!id || !name) continue;
      const rank = str(p.rankKey, 32).toLowerCase();
      const set: Record<string, unknown> = {
        name,
        edition: edition(p.edition),
        lastSeen: now,
        playtimeMinutes: num(p.playtimeMinutes, 0, 1e9),
        kills: num(p.kills, 0, 1e9),
        deaths: num(p.deaths, 0, 1e9),
        balance: num(p.balance, -1e12, 1e12, false),
        rankKey: /^[a-z0-9_-]{1,32}$/.test(rank) ? rank : undefined,
        lastIp: ip(p.lastIp),
      };
      // Only write the fields the plugin actually sent, so a partial entry never zeroes data.
      for (const k of Object.keys(set)) if (set[k] === undefined) delete set[k];
      valid.set(id, set);
    }
    if (body.players.length > 0 && valid.size === 0) return bad("No valid players in request.");
    if (valid.size === 0) return json({ ok: true, upserted: 0 });

    const res = await Player.bulkWrite(
      [...valid].map(([id, set]) => ({
        updateOne: {
          filter: { uuid: id },
          update: { $set: set, $setOnInsert: { uuid: id, firstSeen: now } },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    return json({ ok: true, upserted: res.upsertedCount + res.matchedCount });
  });
}
