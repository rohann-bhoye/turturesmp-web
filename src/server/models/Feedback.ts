import { Schema } from "mongoose";
import { model } from "../db";

// Public feedback / suggestions / complaints from website visitors.
// No login required to submit; staff review in the admin panel.
const FeedbackSchema = new Schema(
  {
    minecraftName: { type: String, trim: true, default: null },
    type: {
      type: String,
      enum: ["suggestion", "complaint", "bug", "other"],
      default: "suggestion",
      index: true,
    },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "read", "closed"],
      default: "open",
      index: true,
    },
    repliedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    repliedAt: { type: Date, default: null },
    replyText: { type: String, default: null },
  },
  { timestamps: true }
);

export const Feedback = model("Feedback", FeedbackSchema);
