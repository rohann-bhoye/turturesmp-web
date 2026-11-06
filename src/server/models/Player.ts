import { Schema } from "mongoose";
import { model } from "../db";

// In-game player record, filled by the TurtureBridge plugin.
const PlayerSchema = new Schema(
  {
    uuid: { type: String, required: true, unique: true },
    name: { type: String, required: true, index: true },
    edition: { type: String, enum: ["java", "bedrock"], default: "java" },
    online: { type: Boolean, default: false, index: true },
    firstSeen: Date,
    lastSeen: Date,
    lastIp: String,
    playtimeMinutes: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    rankKey: { type: String, default: "default" },
    tagKey: String,
    whitelisted: { type: Boolean, default: false },
    notes: [{ by: String, text: String, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

export const Player = model("Player", PlayerSchema);
