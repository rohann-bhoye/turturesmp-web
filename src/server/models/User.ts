import { Schema } from "mongoose";
import { model } from "../db";

// Website accounts (players log in with Discord). `role` controls admin-panel access.
import { ROLES } from "../roles";
export const ADMIN_ROLES = ["owner", "admin", "mod", "viewer"] as const;
export type SiteRole = (typeof ROLES)[number];

const UserSchema = new Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    avatar: String,
    email: { type: String, lowercase: true, trim: true },
    role: { type: String, enum: ROLES, default: "user", index: true },
    minecraft: {
      name: { type: String, trim: true },
      uuid: { type: String, index: true },
      edition: { type: String, enum: ["java", "bedrock"], default: "java" },
      linkedAt: Date,
    },
    twoFactor: { enabled: { type: Boolean, default: false }, secretEnc: String },
    banned: { type: Boolean, default: false },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

export const User = model("User", UserSchema);
