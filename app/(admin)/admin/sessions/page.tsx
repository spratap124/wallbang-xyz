import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminSessionsPanel } from "@/components/admin/admin-sessions-panel";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Sessions",
  description: "Admin view of CS2 player connection sessions across the fleet.",
  path: "/admin/sessions",
  noIndex: true,
});

export default function AdminSessionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Sessions
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Cross-server join → leave history from presence heartbeats.
        </p>
      </div>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
      >
        <AdminSessionsPanel />
      </Suspense>
    </div>
  );
}
