import { NextResponse } from "next/server";
import { requireRole } from "@/server/guard";
import { connectDB } from "@/server/db";
import { Feedback } from "@/server/models/Feedback";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireRole("viewer");

  try {
    const { id: routeId } = await params;
    const contentType = req.headers.get("content-type") || "";

    let id = routeId;
    let status: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      id = String(body.id ?? routeId);
      status = body.status ?? null;
    } else {
      const formData = await req.formData();
      id = String(formData.get("id") ?? routeId);
      status = String(formData.get("status") ?? "");
    }

    if (!id) {
      return NextResponse.json({ error: "Missing feedback id" }, { status: 400 });
    }

    if (!status || !["open", "read", "closed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await connectDB();
    const updated = await Feedback.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    if (!contentType.includes("application/json")) {
      return NextResponse.redirect(new URL("/admin/feedback", req.url));
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update status" }, { status: 500 });
  }
}
