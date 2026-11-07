"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/server/db";
import { User } from "@/server/models";
import { requireRole } from "@/server/guard";
import { audit } from "@/server/audit";
import { isRole } from "@/server/roles";
import { isMaster, MAX_OWNERS } from "@/server/master";

export async function setRole(formData: FormData) {
  const me = await requireRole("owner");
  const id = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!/^[a-f0-9]{24}$/i.test(id) || !isRole(role)) redirect("/admin/staff?error=Invalid+request");
  if (id === me.id) redirect("/admin/staff?error=You+cannot+change+your+own+role");

  await connectDB();
  const target = await User.findById(id);
  if (!target) redirect("/admin/staff?error=User+not+found");
  if (isMaster(target.discordId)) redirect("/admin/staff?error=The+master+owner+cannot+be+changed");
  if (target.role === "owner" || role === "owner") {
    if (!isMaster(me.discordId)) redirect("/admin/staff?error=Only+the+master+owner+can+add+or+change+owners.+Ask+the+master+owner.");
    if (role === "owner" && target.role !== "owner" && (await User.countDocuments({ role: "owner" })) >= MAX_OWNERS)
      redirect(`/admin/staff?error=Maximum+of+${MAX_OWNERS - 1}+owners+besides+the+master`);
  }
  const before = target.role;
  target.role = role;
  await target.save();
  await audit(me, "staff.role", target.username, { discordId: target.discordId, from: before, to: role });
  revalidatePath("/admin/staff");
  redirect("/admin/staff?saved=1");
}

// Removes someone from staff (back to a normal "user" account; their history stays). Owners are protected.
export async function removeStaff(formData: FormData) {
  const me = await requireRole("owner");
  const id = String(formData.get("userId") ?? "");
  if (!/^[a-f0-9]{24}$/i.test(id)) redirect("/admin/staff?error=Invalid+request");
  if (id === me.id) redirect("/admin/staff?error=You+cannot+remove+yourself");

  await connectDB();
  const target = await User.findById(id);
  if (!target) redirect("/admin/staff?error=User+not+found");
  if (isMaster(target.discordId)) redirect("/admin/staff?error=The+master+owner+cannot+be+removed");
  if (target.role === "owner" && !isMaster(me.discordId)) redirect("/admin/staff?error=Only+the+master+owner+can+remove+an+owner.+Ask+the+master+owner.");
  if (target.role === "user") redirect("/admin/staff?error=That+user+is+not+staff");
  const before = target.role;
  target.role = "user";
  await target.save();
  await audit(me, "staff.remove", target.username, { discordId: target.discordId, from: before });
  revalidatePath("/admin/staff");
  redirect("/admin/staff?removed=1");
}
