import { BridgeCommand } from "@/server/models";
import { handle, json, logDelivery } from "../_util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STALE_MS = 2 * 60_000; // a command that stays "sent" this long is offered again
const MAX_ATTEMPTS = 5;

export async function GET(req: Request) {
  return handle(req, async () => {
    const raw = Number(new URL(req.url).searchParams.get("limit"));
    const limit = Number.isFinite(raw) && raw >= 1 ? Math.min(50, Math.floor(raw)) : 20;
    const now = new Date();
    const cutoff = new Date(now.getTime() - STALE_MS);

    // Commands that were handed out five times without a result are given up on.
    const dead = await BridgeCommand.find({ status: "sent", sentAt: { $lt: cutoff }, attempts: { $gte: MAX_ATTEMPTS } }).limit(50).lean();
    for (const c of dead) {
      const r = await BridgeCommand.updateOne(
        { _id: c._id, status: "sent" },
        { $set: { status: "failed", message: `No result after ${MAX_ATTEMPTS} attempts`, doneAt: now } }
      );
      if (r.modifiedCount) await logDelivery(c.orderId, c.type, false, `No result after ${MAX_ATTEMPTS} attempts`);
    }

    // Claim one command at a time with an atomic findOneAndUpdate, so two polls can never get the same one.
    const out: { id: string; type: string; payload: unknown }[] = [];
    while (out.length < limit) {
      const c = await BridgeCommand.findOneAndUpdate(
        {
          $or: [
            { status: "pending" },
            { status: "sent", sentAt: { $lt: cutoff }, attempts: { $lt: MAX_ATTEMPTS } },
          ],
        },
        { $set: { status: "sent", sentAt: now }, $inc: { attempts: 1 } },
        { sort: { createdAt: 1 }, new: true }
      ).lean();
      if (!c) break;
      out.push({ id: String(c._id), type: c.type, payload: c.payload ?? {} });
    }
    return json({ commands: out });
  });
}
