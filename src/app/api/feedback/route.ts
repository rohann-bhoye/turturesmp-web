import { NextResponse } from "next/server";
import { connectDB } from "@/server/db";
import { Feedback } from "@/server/models/Feedback";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { minecraftName, type, message } = body;

    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return NextResponse.json({ error: "Message must be at least 5 characters." }, { status: 400 });
    }

    const validTypes = ["suggestion", "complaint", "bug", "other"];
    const feedbackType = validTypes.includes(type) ? type : "suggestion";

    await connectDB();
    await Feedback.create({
      minecraftName: minecraftName?.trim() || null,
      type: feedbackType,
      message: message.trim(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to submit feedback." }, { status: 500 });
  }
}
