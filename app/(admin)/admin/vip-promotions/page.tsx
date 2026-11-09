import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VipPromotionsPanel } from "@/components/admin/vip-promotions-panel";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/service";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({ title: "Promotional Offers", description: "Schedule temporary VIP pricing offers.", path: "/admin/vip-promotions", noIndex: true });

export default async function AdminVipPromotionsPage() {
  const user = await getSession();
  if (!user) redirect("/");
  if (!(await hasPermission({ userId: user.id, permission: "manage_servers" }))) redirect("/admin");
  return <VipPromotionsPanel />;
}
