import type { Metadata } from "next";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Admin",
  description: "WallBang admin dashboard for roles, permissions, and audit logs.",
  path: "/admin",
  noIndex: true,
});

export default function AdminPage() {
  return (
    <div className="container-wb py-10">
      <div className="mb-8">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Permissions
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Search players, grant or revoke roles, and review audit history.
          Permissions always resolve from active roles — never from payments
          directly.
        </p>
      </div>
      <AdminDashboard />
    </div>
  );
}
