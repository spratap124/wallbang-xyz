import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminServersPanel } from "@/components/admin/admin-servers-panel";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/service";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Servers",
  description: "Admin dashboard for CS2 server fleet registry and configuration.",
  path: "/admin/servers",
  noIndex: true,
});

export default async function AdminServersPage() {
  const user = await getSession();
  if (!user) redirect("/");
  const allowed = await hasPermission({ userId: user.id, permission: "admin_panel" });
  if (!allowed) redirect("/admin/moderation");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Servers</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Add, edit, and enable servers in the fleet registry. Connection history lives
          under{" "}
          <Link
            href="/admin/sessions"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Sessions
          </Link>
          ; fleet KPIs are on Overview.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <AdminServersPanel />
      </Suspense>
    </div>
  );
}
