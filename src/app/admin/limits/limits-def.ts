// The limits editable on Admin > Limits. Convenience limits only (no sell multipliers, claim boosts, god or fly):
// the Minecraft EULA does not allow selling gameplay advantages. To add a limit, add a row here and a field in Rank.limits.
export const MAX_LIMIT = 1000;
export const BASE_HOMES = "essentials.sethome.multiple";

export const LIMITS: { id: "homes" | "auctions" | "jobs"; label: string; /** Permission prefix; the number is appended. Homes are special (named per rank, number lives in Essentials' config). */ prefix?: string }[] = [
  { id: "homes", label: "Homes" },
  { id: "auctions", label: "Auction listings", prefix: "auctionhouse.auctions." },
  { id: "jobs", label: "Max jobs", prefix: "jobs.max." },
];

/** True for the permission nodes this page owns for a rank. */
export function isLimitNode(node: string, rankKey: string): boolean {
  if (node === BASE_HOMES || node === `${BASE_HOMES}.${rankKey}`) return true;
  return LIMITS.some((l) => l.prefix && node.startsWith(l.prefix) && /^\d+$/.test(node.slice(l.prefix.length)));
}

/** The number in a rank's permission list for a limit, if any (used when the page was never saved). */
export function numberFromPerms(perms: string[] = [], prefix: string): number | undefined {
  const n = perms.map((p) => (p.startsWith(prefix) && /^\d+$/.test(p.slice(prefix.length)) ? Number(p.slice(prefix.length)) : 0)).filter(Boolean);
  return n.length ? Math.max(...n) : undefined;
}
