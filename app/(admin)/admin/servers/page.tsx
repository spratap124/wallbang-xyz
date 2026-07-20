import type { Metadata } from "next";

import { AdminNav } from "@/components/admin/admin-nav";
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
    <div className="container-wb py-10">
      <AdminNav />
      <div className="mb-8">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Servers</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Manage the CS2 fleet in the database, and review unique players,
          sessions, and play time per server.
        </p>
      </div>
      <AdminServersPanel />
    </div>
  );
}
