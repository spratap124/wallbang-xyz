import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminAuditPanel } from "@/components/admin/admin-audit-panel";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/service";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Audit Log",
  description: "Admin audit history for moderation, roles, and server actions.",
  path: "/admin/audit",
  noIndex: true,
});

export default async function AdminAuditPage() {
  const user = await getSession();
  if (!user) redirect("/");
  const allowed = await hasPermission({ userId: user.id, permission: "admin_panel" });
  if (!allowed) redirect("/admin/moderation");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Audit Log</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Recent moderation, permission, and server actions across the platform.
        </p>
      </div>
      <AdminAuditPanel />
    </div>
  );
}
