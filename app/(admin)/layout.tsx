import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminHealth } from "@/lib/admin/health";
import { featureFlags } from "@/config/features.flags";
import { isSteamAuthConfigured } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
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
  if (!resolved?.permissions.includes("admin_panel")) {
    redirect("/");
  }

  let healthLabel = "All Systems Operational";
  let healthOk = true;
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

  return (
    <AdminShell
      user={user}
      displayRole={resolved.displayRole}
      permissions={resolved.permissions}
      healthLabel={healthLabel}
      healthOk={healthOk}
      steamAuthEnabled={steamAuthEnabled}
    >
      {children}
    </AdminShell>
  );
}
