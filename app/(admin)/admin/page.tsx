import type { Metadata } from "next";

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

  return (
    <OverviewDashboard
      user={user}
      displayRole={resolved?.displayRole ?? "ADMIN"}
      canManageServers={
        resolved?.permissions.includes("manage_servers") ?? false
      }
    />
  );
}
