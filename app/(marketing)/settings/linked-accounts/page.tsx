import { redirect } from "next/navigation";

import { SettingsSidebar } from "@/components/profile/settings-sidebar";
import { Container } from "@/components/shared/primitives";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { featureFlags } from "@/config/features.flags";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Linked Accounts",
  description: "Connect Discord, FACEIT, and other accounts to WallBang.",
  path: "/settings/linked-accounts",
  noIndex: true,
});

const PROVIDERS = [
  { id: "steam", label: "Steam", status: "Connected" },
  { id: "discord", label: "Discord", status: "Coming soon" },
  { id: "faceit", label: "FACEIT", status: "Coming soon" },
  { id: "youtube", label: "YouTube", status: "Coming soon" },
  { id: "twitch", label: "Twitch", status: "Coming soon" },
] as const;

export default async function LinkedAccountsPage() {
  if (!featureFlags.playerProfiles) {
    redirect("/");
  }
  if (!isMongoConfigured()) {
    redirect("/?authError=database");
  }

  const user = await getSession();
  if (!user) {
    redirect("/api/auth/steam?returnTo=/settings/linked-accounts");
  }

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Linked Accounts
          </h1>
          <p className="mt-2 text-muted-foreground">
            Steam is linked via login. More providers land in Sprint 3.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[14rem_minmax(0,1fr)]">
          <SettingsSidebar />

          <Card>
            <CardHeader>
              <CardTitle>Providers</CardTitle>
              <CardDescription>
                Connect external accounts to your WallBang player profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {PROVIDERS.map((provider) => (
                <div
                  key={provider.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{provider.label}</p>
                    {provider.id === "steam" ? (
                      <p className="font-mono text-xs text-muted-foreground">
                        {user.steamId}
                      </p>
                    ) : null}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {provider.status}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Container>
    </div>
  );
}
