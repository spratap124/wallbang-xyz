import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminSettingsPanel } from "@/components/admin/admin-settings-panel";
import { getSession } from "@/lib/auth/session";
import { getRuntimeFeatureFlags } from "@/lib/platform/feature-flags";
import { hasPermission } from "@/lib/permissions/service";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Admin Settings",
  description: "Read-only admin panel configuration and environment status.",
  path: "/admin/settings",
  noIndex: true,
});

export default async function AdminSettingsPage() {
  const user = await getSession();
  if (!user) redirect("/");
  const allowed = await hasPermission({ userId: user.id, permission: "admin_panel" });
  if (!allowed) redirect("/admin/moderation");

  const featureFlags = await getRuntimeFeatureFlags();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Panel configuration and runtime feature toggles.
        </p>
      </div>
      <AdminSettingsPanel featureFlags={featureFlags} />
    </div>
  );
}
