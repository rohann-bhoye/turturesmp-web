import { Schema } from "mongoose";
import { model } from "../db";

// One document per editable section of the public pages (team, rules, faq, ...). Edited in Admin > Site content.
// No document for a section means the public page uses the defaults from src/data.ts.
const SiteContentSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    items: { type: [Schema.Types.Mixed], default: [] },
    updatedBy: String,
  },
  { timestamps: true }
);

export const SiteContent = model("SiteContent", SiteContentSchema);
