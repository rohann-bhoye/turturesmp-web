import { Schema } from "mongoose";
import { model } from "../db";

export const PUNISH_TYPES = ["ban", "tempban", "ipban", "mute", "tempmute", "kick", "warn"] as const;

const PunishmentSchema = new Schema(
  {
    playerUuid: { type: String, required: true, index: true },
    playerName: { type: String, required: true },
    type: { type: String, enum: PUNISH_TYPES, required: true },
    reason: { type: String, default: "No reason given" },
    issuedBy: { type: String, required: true }, // staff name, or "Console"
    issuedById: { type: Schema.Types.ObjectId, ref: "User" },
    source: { type: String, enum: ["web", "ingame", "discord"], default: "web" },
    ip: String, // only for ipban
    expiresAt: Date, // empty = permanent
    active: { type: Boolean, default: true, index: true },
    revokedBy: String,
    revokedAt: Date,
    revokeReason: String,
  },
  { timestamps: true }
);

export const Punishment = model("Punishment", PunishmentSchema);

const AppealSchema = new Schema(
  {
    punishmentId: { type: Schema.Types.ObjectId, ref: "Punishment", required: true },
    playerName: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    message: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ["open", "accepted", "denied"], default: "open", index: true },
    reviewedBy: String,
    reviewNote: String,
    reviewedAt: Date,
  },
  { timestamps: true }
);

export const Appeal = model("Appeal", AppealSchema);
