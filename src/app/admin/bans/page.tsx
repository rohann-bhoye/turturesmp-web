import ComingSoon from "@/components/admin/ComingSoon";
import { getCurrentUser } from "@/server/session";
import { redirect } from "next/navigation";

export default async function Page() {
  if (!(await getCurrentUser())) redirect("/login");
  return <ComingSoon title="Bans & Mutes" phase="Phase 3" items={["Ban, temp-ban, IP-ban, mute, kick and warn", "Unban and revoke with a reason", "Review player appeals"]} />;
}
