"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/server/db";
import { User } from "@/server/models";
import { requireRole } from "@/server/guard";
import { audit } from "@/server/audit";
import { isRole } from "@/server/roles";

export async function setRole(formData: FormData) {
  const me = await requireRole("owner");
  const id = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!/^[a-f0-9]{24}$/i.test(id) || !isRole(role)) redirect("/admin/staff?error=Invalid+request");
  if (id === me.id) redirect("/admin/staff?error=You+cannot+change+your+own+role");

  await connectDB();
  const target = await User.findById(id);
  if (!target) redirect("/admin/staff?error=User+not+found");
  const before = target.role;
  target.role = role;
  await target.save();
  await audit(me, "staff.role", target.username, { discordId: target.discordId, from: before, to: role });
  revalidatePath("/admin/staff");
  redirect("/admin/staff?saved=1");
}
