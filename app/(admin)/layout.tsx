import { redirect } from "next/navigation";
import { connection } from "next/server";

import { SiteHeader } from "@/components/layout/site-header";
import { featureFlags } from "@/config/features.flags";
import { isSteamAuthConfigured } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/service";
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

  const allowed = await hasPermission({
    userId: user.id,
    permission: "admin_panel",
  });
  if (!allowed) {
    redirect("/");
  }

  return (
    <>
      <SiteHeader
        user={user}
        steamAuthEnabled={steamAuthEnabled}
        showAdmin
      />
      <main id="main-content" className="min-h-[calc(100vh-4rem)]">
        {children}
      </main>
    </>
  );
}
