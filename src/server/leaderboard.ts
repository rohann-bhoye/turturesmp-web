import { connectDB } from "./db";
import { Player } from "./models/Player";
import { Punishment } from "./models/Punishment";
import { Rank } from "./models/Rank";
import { BAN_TYPES, formatMinutes } from "./players-util";

// Same four boards as the in-game DirtyLeaderboards rotation: kills, deaths, playtime, balance.
export type Metric = "kills" | "deaths" | "playtime" | "balance";

export type LbRow = {
  uuid: string;
  name: string;
  online: boolean;
  rankName: string;
  rankColor: string;
  /** Every stat, already formatted for display ("3h 17m", "$12,400", "54"). */
  values: Record<Metric, string>;
};
export type Boards = Record<Metric, LbRow[]>;

export const EMPTY_BOARDS: Boards = { kills: [], deaths: [], playtime: [], balance: [] };

const TOP = 25;

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

type Doc = { uuid: string; name: string; online?: boolean; rankKey?: string; playtimeMinutes?: number; kills?: number; deaths?: number; balance?: number };

/** Public leaderboards from the synced player records. Never throws: on any error the boards are empty. */
export async function getLeaderboards(): Promise<Boards> {
  try {
    await connectDB();
    const now = new Date();

    // Hide players with an active ban.
    const bans = await Punishment.find(
      { active: true, type: { $in: BAN_TYPES as unknown as string[] }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { playerUuid: 1 }
    ).lean();
    const banned = bans.map((b) => b.playerUuid);
    const base = banned.length ? { uuid: { $nin: banned } } : {};

    // Only public fields are read: never IPs or notes.
    const proj = { uuid: 1, name: 1, online: 1, rankKey: 1, playtimeMinutes: 1, kills: 1, deaths: 1, balance: 1 };
    const top = (field: string) =>
      Player.find({ ...base, [field]: { $gt: 0 } }, proj).sort({ [field]: -1 }).limit(TOP).lean<Doc[]>();

    const [ranks, kills, deaths, playtime, balance] = await Promise.all([
      Rank.find({}, { key: 1, displayName: 1, color: 1 }).lean(),
      top("kills"),
      top("deaths"),
      top("playtimeMinutes"),
      top("balance"),
    ]);

    const rankMap = new Map(ranks.map((r) => [r.key, r]));
    const toRow = (p: Doc): LbRow => {
      const rk = rankMap.get(p.rankKey || "default");
      return {
        uuid: p.uuid,
        name: p.name,
        online: !!p.online,
        rankName: rk?.displayName ?? (p.rankKey || "default"),
        rankColor: rk?.color && /^#[0-9a-f]{6}$/i.test(rk.color) ? rk.color : "#8fa399",
        values: {
          kills: (p.kills ?? 0).toLocaleString("en-US"),
          deaths: (p.deaths ?? 0).toLocaleString("en-US"),
          playtime: formatMinutes(p.playtimeMinutes),
          balance: money(p.balance ?? 0),
        },
      };
    };

    return { kills: kills.map(toRow), deaths: deaths.map(toRow), playtime: playtime.map(toRow), balance: balance.map(toRow) };
  } catch (e) {
    console.error("leaderboard: could not load stats", e);
    return EMPTY_BOARDS;
  }
}
