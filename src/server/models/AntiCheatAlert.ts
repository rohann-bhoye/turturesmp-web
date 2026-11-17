import { Schema } from "mongoose";
import { model } from "../db";

const AntiCheatAlertSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true },
    playerUuid: { type: String, required: true, index: true },
    playerName: { type: String, required: true },
    checkName: { type: String, required: true },
    verbose: { type: String, default: "" },
    flagCount: { type: Number, required: true },
    threshold: { type: Number, required: true },
    windowSeconds: { type: Number, required: true },
    cancelled: { type: Boolean, default: false },
    serverName: { type: String, required: true },
  },
  { timestamps: true }
);

AntiCheatAlertSchema.index({ createdAt: -1 });
AntiCheatAlertSchema.index({ playerUuid: 1, createdAt: -1 });

export const AntiCheatAlert = model("AntiCheatAlert", AntiCheatAlertSchema);
