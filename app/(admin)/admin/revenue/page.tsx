import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RevenueDashboard } from "@/components/admin/revenue-dashboard";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/service";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Admin Revenue",
  description: "WallBang VIP purchase and revenue analytics.",
  path: "/admin/revenue",
  noIndex: true,
});

export default async function AdminRevenuePage() {
  const user = await getSession();
  if (!user) redirect("/");
  if (!(await hasPermission({ userId: user.id, permission: "admin_panel" }))) {
    redirect("/admin");
  }
  return <RevenueDashboard />;
}
