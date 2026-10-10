import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminHealth } from "@/lib/admin/health";
import { featureFlags } from "@/config/features.flags";
import { isSteamAuthConfigured } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
import { getRuntimeFeatureFlags } from "@/lib/platform/feature-flags";
import { getUserPermissions } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();

  if (!featureFlags.adminPanel) {
    redirect("/");
  }

  const steamAuthEnabled = featureFlags.steamAuth && isSteamAuthConfigured();
  const user = steamAuthEnabled ? await getSession() : null;

  if (!user || !isMongoConfigured()) {
    redirect("/");
  }

  const resolved = await getUserPermissions({ userId: user.id });
  const permissions = resolved?.permissions ?? [];
  const canAccessAdminPanel = permissions.includes("admin_panel");
  const canAccessModeration = permissions.includes("moderation_access");
  if (!resolved || (!canAccessAdminPanel && !canAccessModeration)) {
    redirect("/");
  }

  let healthLabel = canAccessAdminPanel ? "All Systems Operational" : "Moderation access";
  let healthOk = true;
  if (canAccessAdminPanel) {
    try {
      const health = await getAdminHealth();
      healthOk = health.overall === "operational";
      if (health.overall === "operational") {
        healthLabel = "All Systems Operational";
      } else if (health.overall === "degraded") {
        healthLabel = "Degraded Performance";
      } else {
        healthLabel = "Systems Down";
      }
    } catch {
      healthOk = false;
      healthLabel = "Status Unavailable";
    }
  }

  const flags = canAccessAdminPanel
    ? await getRuntimeFeatureFlags().catch(() => featureFlags)
    : featureFlags;

  return (
    <AdminShell
      user={user}
      displayRole={resolved.displayRole}
      permissions={permissions}
      healthLabel={healthLabel}
      healthOk={healthOk}
      steamAuthEnabled={steamAuthEnabled}
      showVip={flags.vipPage}
      showLoadout={flags.loadoutPage}
      showFeatures={flags.featuresPage}
      showPricing={flags.pricingPage}
      showProfile={flags.profilePage}
      showSettings={flags.settingsPage}
    >
      {children}
    </AdminShell>
  );
}
