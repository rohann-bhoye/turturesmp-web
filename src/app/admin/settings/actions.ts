"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/server/db";
import { ServerSettings } from "@/server/models";
import { requireRole } from "@/server/guard";
import { audit } from "@/server/audit";

const HOST = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/i;
const text = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
const port = (f: FormData, k: string) => {
  const n = Number(f.get(k));
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : null;
};
const httpsUrl = (v: string) => {
  if (!v) return "";
  try {
    return new URL(v).protocol === "https:" ? v : null;
  } catch {
    return null;
  }
};

export async function saveSettings(formData: FormData) {
  const user = await requireRole("admin");
  const fail = (msg: string) => redirect(`/admin/settings?error=${encodeURIComponent(msg)}`);

  const name = text(formData, "name", 40);
  const javaIp = text(formData, "javaIp", 253);
  const bedrockIp = text(formData, "bedrockIp", 253);
  const javaPort = port(formData, "javaPort");
  const bedrockPort = port(formData, "bedrockPort");
  const maxPlayers = Number(formData.get("maxPlayers"));
  const discordInvite = httpsUrl(text(formData, "discordInvite", 200));
  const storeUrl = httpsUrl(text(formData, "storeUrl", 200));
  const panelUrl = httpsUrl(text(formData, "panelUrl", 200));
  const software = text(formData, "software", 20);

  if (!name) return fail("Server name is required.");
  if (!HOST.test(javaIp) || !HOST.test(bedrockIp)) return fail("IP / hostname looks invalid.");
  if (!javaPort || !bedrockPort) return fail("Ports must be between 1 and 65535.");
  if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 5000) return fail("Max players must be 1 to 5000.");
  if (discordInvite === null || storeUrl === null || panelUrl === null) return fail("Links must start with https://");
  if (!["paper", "spigot", "purpur", "fabric", "forge", "neoforge", "other"].includes(software)) return fail("Unknown server software.");
  const panelType = text(formData, "panelType", 20);
  if (!["none", "pterodactyl", "pelican", "amp", "other"].includes(panelType)) return fail("Unknown panel type.");

  const update = {
    name,
    java: { ip: javaIp, port: javaPort },
    bedrock: { ip: bedrockIp, port: bedrockPort },
    version: text(formData, "version", 16),
    software,
    motd: text(formData, "motd", 200),
    maxPlayers,
    access: {
      whitelistEnabled: formData.get("whitelistEnabled") === "on",
      maintenanceMode: formData.get("maintenanceMode") === "on",
      maintenanceMessage: text(formData, "maintenanceMessage", 200),
      allowBedrock: formData.get("allowBedrock") === "on",
      requireDiscordLink: formData.get("requireDiscordLink") === "on",
      defaultBanReason: text(formData, "defaultBanReason", 200),
    },
    panel: { type: panelType, url: panelUrl, serverId: text(formData, "panelServerId", 80) },
    links: { discordInvite, storeUrl },
  };

  await connectDB();
  await ServerSettings.findOneAndUpdate({ key: "main" }, { $set: update }, { upsert: true });
  await audit(user, "settings.update", "server", { name, javaIp, javaPort, bedrockIp, bedrockPort, maintenance: update.access.maintenanceMode });
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}
