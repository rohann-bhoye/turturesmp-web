import ComingSoon from "@/components/admin/ComingSoon";
import { getCurrentUser } from "@/server/session";
import { redirect } from "next/navigation";

export default async function Page() {
  if (!(await getCurrentUser())) redirect("/login");
  return <ComingSoon title="Store & Orders" phase="Phase 5" items={["Create products: ranks, tags, Discord roles, keys, bundles", "Orders, refunds and coupon codes", "Razorpay / Stripe payments and automatic delivery"]} />;
}
