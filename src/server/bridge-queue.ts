import "server-only";
import { connectDB } from "./db";
import { BridgeCommand, CommandType } from "./models/BridgeCommand";

// The single entry point for "make the Minecraft server do X". See docs/BRIDGE_API.md for payloads.
export async function queueCommand(
  type: CommandType,
  payload: Record<string, unknown>,
  opts: { createdBy?: string; orderId?: string } = {}
) {
  await connectDB();
  const cmd = await BridgeCommand.create({ type, payload, createdBy: opts.createdBy ?? "system", orderId: opts.orderId });
  return String(cmd._id);
}
