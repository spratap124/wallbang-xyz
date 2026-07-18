import { Suspense } from "react";
import { connection } from "next/server";

import { AuthErrorBanner } from "@/components/auth/auth-error-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { featureFlags } from "@/config/features.flags";
import { isSteamAuthConfigured } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

/**
 * Auth env (STEAM_API_KEY / AUTH_SECRET) is injected at container runtime, not
 * Docker build time. Defer this layout so steamAuthEnabled is not baked false
 * into the static RSC payload.
 */
export const dynamic = "force-dynamic";

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const steamAuthEnabled = featureFlags.steamAuth && isSteamAuthConfigured();
  const user = steamAuthEnabled ? await getSession() : null;

  let showAdmin = false;
  if (
    user &&
    featureFlags.adminPanel &&
    isMongoConfigured()
  ) {
    try {
      showAdmin = await hasPermission({
        userId: user.id,
        permission: "admin_panel",
      });
    } catch {
      showAdmin = false;
    }
  }

  return (
    <>
      <SiteHeader
        user={user}
        steamAuthEnabled={steamAuthEnabled}
        showAdmin={showAdmin}
      />
      <Suspense fallback={null}>
        <AuthErrorBanner />
      </Suspense>
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  );
}
