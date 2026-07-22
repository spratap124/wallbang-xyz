import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminServersPanel } from "@/components/admin/admin-servers-panel";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Servers",
  description:
    "Admin dashboard for CS2 server fleet registry, connection activity, and player presence.",
  path: "/admin/servers",
  noIndex: true,
});

export default function AdminServersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Servers
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Manage the CS2 fleet and review unique players, sessions, and play
          time per server.
        </p>
      </div>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
      >
        <AdminServersPanel />
      </Suspense>
    </div>
  );
}
