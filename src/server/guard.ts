import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, SessionUser } from "./session";
import { hasRole, Role } from "./roles";

// Use at the top of every admin page and server action. Redirects away if the role is too low.
export async function requireRole(min: Role): Promise<SessionUser> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  if (!hasRole(user.role, min)) redirect("/admin");
  return user;
}
