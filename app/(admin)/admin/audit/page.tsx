import type { Metadata } from "next";

import { AdminAuditPanel } from "@/components/admin/admin-audit-panel";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Audit Log",
  description: "Admin audit history for role grants and revokes.",
  path: "/admin/audit",
  noIndex: true,
});

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Audit Log
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Recent permission changes across the platform.
        </p>
      </div>
      <AdminAuditPanel />
    </div>
  );
}
