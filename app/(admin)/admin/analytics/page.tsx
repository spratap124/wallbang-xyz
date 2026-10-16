import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { getSession } from "@/lib/auth/session";
import { getUserPermissions } from "@/lib/permissions/service";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Admin Analytics",
  description:
    "WallBang CS2 player activity, retention, server performance, and revenue analytics.",
  path: "/admin/analytics",
  noIndex: true,
});

export default async function AdminAnalyticsPage() {
  const user = await getSession();
  if (!user) return null;

  const resolved = await getUserPermissions({ userId: user.id });
  if (!resolved?.permissions.includes("admin_panel")) {
    if (resolved?.permissions.includes("moderation_access")) {
      redirect("/admin/moderation");
    }
    redirect("/");
  }

  return (
    <AnalyticsDashboard
      canManageServers={resolved.permissions.includes("manage_servers")}
    />
  );
}
