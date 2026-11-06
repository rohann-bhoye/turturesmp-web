import { Schema } from "mongoose";
import { model } from "../db";

// Single document (key: "main") edited from Admin > Settings.
// Secrets (panel API key, bridge key) are NOT stored here: they live in env vars.
const ServerSettingsSchema = new Schema(
  {
    key: { type: String, default: "main", unique: true },
    name: { type: String, default: "Turture SMP" },
    java: { ip: { type: String, default: "play.turturesmp.dpdns.org" }, port: { type: Number, default: 25565 } },
    bedrock: { ip: { type: String, default: "play.turturesmp.dpdns.org" }, port: { type: Number, default: 19132 } },
    version: { type: String, default: "1.21" },
    software: { type: String, enum: ["paper", "spigot", "purpur", "fabric", "forge", "neoforge", "other"], default: "paper" },
    motd: { type: String, default: "Turture SMP - friendly survival" },
    maxPlayers: { type: Number, default: 50 },
    access: {
      whitelistEnabled: { type: Boolean, default: false },
      maintenanceMode: { type: Boolean, default: false },
      maintenanceMessage: { type: String, default: "The server is under maintenance. Back soon!" },
      allowBedrock: { type: Boolean, default: true },
      requireDiscordLink: { type: Boolean, default: false },
      defaultBanReason: { type: String, default: "Breaking server rules" },
    },
    panel: {
      type: { type: String, enum: ["none", "pterodactyl", "pelican", "amp", "other"], default: "none" },
      url: String,
      serverId: String,
    },
    links: { discordInvite: String, storeUrl: String, voteUrls: [String] },
    bridge: { lastSeenAt: Date, version: String }, // updated by the plugin heartbeat
  },
  { timestamps: true }
);

export const ServerSettings = model("ServerSettings", ServerSettingsSchema);
