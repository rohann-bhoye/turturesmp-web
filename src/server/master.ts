import "server-only";

export const MAX_OWNERS = 3; // 1 master + 2 other owners

// The master owner is the FIRST id in OWNER_DISCORD_IDS. Nobody can change or remove them.
// Only the master can add, change or remove other owners (1 master + 2 other owners (MAX_OWNERS = 3 in total)).
export const masterDiscordId = () => (process.env.OWNER_DISCORD_IDS || "").split(",").map((s) => s.trim()).filter(Boolean)[0] || "";
export const isMaster = (discordId?: string | null) => !!discordId && discordId === masterDiscordId();
