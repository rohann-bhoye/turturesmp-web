import ComingSoon from "@/components/admin/ComingSoon";
import { getCurrentUser } from "@/server/session";
import { redirect } from "next/navigation";

export default async function Page() {
  if (!(await getCurrentUser())) redirect("/login");
  return <ComingSoon title="Ranks & Tags" phase="Phase 4" items={["Create and edit ranks (synced with LuckPerms)", "Set prefix, colour, weight and permissions", "Create chat tags and assign them to players"]} />;
}
