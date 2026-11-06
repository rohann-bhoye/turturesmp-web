import ComingSoon from "@/components/admin/ComingSoon";
import { getCurrentUser } from "@/server/session";
import { redirect } from "next/navigation";

export default async function Page() {
  if (!(await getCurrentUser())) redirect("/login");
  return <ComingSoon title="Players" phase="Phase 3" items={["Search players and see playtime, rank and history", "Add staff notes", "Whitelist and unwhitelist"]} />;
}
