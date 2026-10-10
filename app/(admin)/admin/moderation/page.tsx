import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ModerationDashboard } from "@/components/admin/moderation-dashboard";
import { getSession } from "@/lib/auth/session";
import { getUserPermissions } from "@/lib/permissions/service";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Moderation",
  description: "Review player reports and manage WallBang global bans.",
  path: "/admin/moderation",
  noIndex: true,
});

export default async function ModerationPage() {
  const user = await getSession();
  if (!user) redirect("/");

  const resolved = await getUserPermissions({ userId: user.id });
  if (!resolved?.permissions.includes("moderation_access")) {
    redirect(resolved?.permissions.includes("admin_panel") ? "/admin" : "/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Moderation</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Review reports, inspect player history, and apply global bans according to your
          role permissions.
        </p>
      </div>
      <ModerationDashboard userId={user.id} permissions={resolved.permissions} />
    </div>
  );
}
