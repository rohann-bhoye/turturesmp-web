import { Schema } from "mongoose";
import { model } from "../db";

// Every admin action is written here (who, what, on whom, from where).
const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorName: { type: String, required: true },
    action: { type: String, required: true, index: true }, // e.g. "player.ban", "rank.update", "settings.update"
    target: String,
    meta: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog = model("AuditLog", AuditLogSchema);
