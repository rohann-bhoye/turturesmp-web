import { BridgeCommand } from "@/server/models";
import { OBJECT_ID, bad, handle, isObj, json, logDelivery, str } from "../../../_util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, async (body) => {
    if (!OBJECT_ID.test(id)) return bad("Invalid command id.");
    if (!isObj(body) || typeof body.ok !== "boolean") return bad("'ok' must be a boolean.");
    if (body.message !== undefined && body.message !== null && typeof body.message !== "string") return bad("'message' must be a string.");

    const ok: boolean = body.ok;
    const message = str(body.message, 500);

    // Only an unfinished command can receive a result, so a retried POST never logs twice.
    const cmd = await BridgeCommand.findOneAndUpdate(
      { _id: id, status: { $in: ["pending", "sent"] } },
      { $set: { status: ok ? "done" : "failed", message, doneAt: new Date() } },
      { new: true }
    ).lean();

    if (!cmd) {
      const exists = await BridgeCommand.exists({ _id: id });
      return exists ? json({ ok: true }) : bad("Command not found.", 404);
    }
    if (cmd.orderId) await logDelivery(cmd.orderId, cmd.type, ok, message || undefined);
    return json({ ok: true });
  });
}
