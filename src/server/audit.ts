import "server-only";
import { connectDB } from "./db";
import { AuditLog } from "./models";
import type { SessionUser } from "./session";

// Records an admin action. Never throws: a logging failure must not block the action itself.
export async function audit(actor: SessionUser, action: string, target?: string, meta?: Record<string, unknown>) {
  try {
    await connectDB();
    await AuditLog.create({ actorId: actor.id, actorName: actor.username, action, target, meta });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
