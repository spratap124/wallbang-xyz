import { Suspense } from "react";

import { AuthErrorBanner } from "@/components/auth/auth-error-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { featureFlags } from "@/config/features.flags";
import { isSteamAuthConfigured } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const steamAuthEnabled = featureFlags.steamAuth && isSteamAuthConfigured();
  const user = steamAuthEnabled ? await getSession() : null;

  return (
    <>
      <SiteHeader user={user} steamAuthEnabled={steamAuthEnabled} />
      <Suspense fallback={null}>
        <AuthErrorBanner />
      </Suspense>
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  );
}
