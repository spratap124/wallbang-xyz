import { LoadoutLoginGate } from "@/components/loadout/loadout-login-gate";
import { LoadoutPage } from "@/components/loadout/loadout-page";
import { JsonLd } from "@/components/shared/json-ld";
import { featureFlags } from "@/config/features.flags";
import { isSteamAuthConfigured } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Loadout",
  description:
    "Build your personal CS2 loadout on WallBang — equip weapon skins, knives, gloves, and agents. Changes sync to our servers when you join.",
  path: "/loadout",
  noIndex: true,
});

export default async function LoadoutRoutePage() {
  const steamAvailable =
    featureFlags.steamAuth && isSteamAuthConfigured();
  const user = steamAvailable ? await getSession() : null;

  return (
    <>
      <JsonLd
        id="ld-loadout-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Loadout", path: "/loadout" },
        ])}
      />
      {user ? (
        <LoadoutPage />
      ) : (
        <LoadoutLoginGate steamAvailable={steamAvailable} />
      )}
    </>
  );
}
