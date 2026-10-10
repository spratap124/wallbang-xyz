import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OverviewDashboard } from "@/components/admin/overview-dashboard";
import { getSession } from "@/lib/auth/session";
import { getUserPermissions } from "@/lib/permissions/service";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Admin Overview",
  description: "WallBang admin overview for CS2 fleet health and activity.",
  path: "/admin",
  noIndex: true,
});

export default async function AdminOverviewPage() {
  const user = await getSession();
  if (!user) return null;

  const resolved = await getUserPermissions({ userId: user.id });
  if (!resolved?.permissions.includes("admin_panel")) {
    if (resolved?.permissions.includes("moderation_access"))
      redirect("/admin/moderation");
    redirect("/");
  }

  return (
    <OverviewDashboard
      user={user}
      displayRole={resolved?.displayRole ?? "ADMIN"}
      canManageServers={resolved?.permissions.includes("manage_servers") ?? false}
    />
  );
}
