import { Schema } from "mongoose";
import { model } from "../db";

// Ranks mirror LuckPerms groups. Chat tags are cosmetic extras players can own.
const RankSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true }, // = LuckPerms group name
    displayName: { type: String, required: true },
    color: { type: String, default: "#ffffff" },
    prefix: { type: String, default: "" },
    suffix: { type: String, default: "" },
    weight: { type: Number, default: 0 },
    inherits: [String],
    permissions: [String],
    isStaff: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    discordRoleId: String,
    syncedAt: Date, // last time pushed to / pulled from the server
  },
  { timestamps: true }
);
export const Rank = model("Rank", RankSchema);

const TagSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    display: { type: String, required: true }, // e.g. "[Legend]"
    color: { type: String, default: "#ffd54a" },
    description: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export const Tag = model("Tag", TagSchema);
