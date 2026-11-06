import { Schema } from "mongoose";
import { model } from "../db";

// Queue of things the website wants the Minecraft server to do. The TurtureBridge plugin polls it.
export const COMMAND_TYPES = [
  "ban", "unban", "mute", "unmute", "kick", "warn",
  "whitelist_add", "whitelist_remove",
  "rank_set", "rank_remove", "tag_set", "rank_define",
  "run_command", "broadcast", "reload_settings",
] as const;
export type CommandType = (typeof COMMAND_TYPES)[number];

const BridgeCommandSchema = new Schema(
  {
    type: { type: String, enum: COMMAND_TYPES, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["pending", "sent", "done", "failed"], default: "pending", index: true },
    attempts: { type: Number, default: 0 },
    message: String, // result text from the plugin
    createdBy: String, // staff name, "system" or "store"
    orderId: { type: Schema.Types.ObjectId, ref: "Order" }, // set when a purchase caused it
    sentAt: Date,
    doneAt: Date,
    // Old finished commands are removed automatically after 30 days.
    expireAt: { type: Date, default: () => new Date(Date.now() + 30 * 864e5), index: { expires: 0 } },
  },
  { timestamps: true }
);
BridgeCommandSchema.index({ status: 1, createdAt: 1 });

export const BridgeCommand = model("BridgeCommand", BridgeCommandSchema);
