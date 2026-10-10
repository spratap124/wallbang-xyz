import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminSessionsPanel } from "@/components/admin/admin-sessions-panel";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/service";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Sessions",
  description: "Admin view of CS2 player connection sessions across the fleet.",
  path: "/admin/sessions",
  noIndex: true,
});

export default async function AdminSessionsPage() {
  const user = await getSession();
  if (!user) redirect("/");
  const canAccessAdminPanel = await hasPermission({
    userId: user.id,
    permission: "admin_panel",
  });
  if (!canAccessAdminPanel) redirect("/admin/moderation");

  const canManageRoles = await hasPermission({
    userId: user.id,
    permission: "manage_users",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sessions</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Cross-server join → leave history from presence heartbeats. Sessions older than
          30 days are pruned automatically.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <AdminSessionsPanel canManageRoles={canManageRoles} />
      </Suspense>
    </div>
  );
}
