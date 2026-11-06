import { Player, ServerSettings } from "@/server/models";
import { bad, edition, handle, isObj, json, playerName, str, uuid } from "../_util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ONLINE = 2000;

export async function POST(req: Request) {
  return handle(req, async (body) => {
    if (!isObj(body)) return bad("Body must be a JSON object.");
    if (!Array.isArray(body.online)) return bad("'online' must be an array.");
    if (body.online.length > MAX_ONLINE) return bad(`'online' has more than ${MAX_ONLINE} entries.`);

    const now = new Date();
    const online = new Map<string, { name: string; edition: "java" | "bedrock" }>();
    for (const p of body.online) {
      const id = isObj(p) ? uuid(p.uuid) : null;
      const name = isObj(p) ? playerName(p.name) : "";
      if (!id || !name) return bad("Every 'online' entry needs a valid uuid and name.");
      online.set(id, { name, edition: edition((p as any).edition) });
    }

    const version = str(body.version, 64);
    const settings = await ServerSettings.findOneAndUpdate(
      { key: "main" },
      { $set: { "bridge.lastSeenAt": now, ...(version ? { "bridge.version": version } : {}) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    if (online.size) {
      await Player.bulkWrite(
        [...online].map(([id, p]) => ({
          updateOne: {
            filter: { uuid: id },
            update: {
              $set: { name: p.name, edition: p.edition, online: true, lastSeen: now },
              $setOnInsert: { uuid: id, firstSeen: now },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    }
    // Everyone not in the list is offline now.
    await Player.updateMany({ online: true, uuid: { $nin: [...online.keys()] } }, { $set: { online: false } });

    const a = (settings as any)?.access ?? {};
    return json({
      ok: true,
      settings: {
        whitelistEnabled: a.whitelistEnabled ?? false,
        maintenanceMode: a.maintenanceMode ?? false,
        maintenanceMessage: a.maintenanceMessage ?? "The server is under maintenance. Back soon!",
        allowBedrock: a.allowBedrock ?? true,
      },
    });
  });
}
