import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/service";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Permissions",
  description: "WallBang admin dashboard for roles, permissions, and grants.",
  path: "/admin/permissions",
  noIndex: true,
});

export default async function AdminPermissionsPage() {
  const user = await getSession();
  if (!user) redirect("/");
  const allowed = await hasPermission({
    userId: user.id,
    permission: "manage_users",
  });
  if (!allowed) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Permissions
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Search players, grant or revoke roles. Permissions always resolve from
          active roles — never from payments directly.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <AdminDashboard />
      </Suspense>
    </div>
  );
}
