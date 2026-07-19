import Link from "next/link";
import { redirect } from "next/navigation";

import { SettingsSidebar } from "@/components/profile/settings-sidebar";
import { Container } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
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
import { ensurePlayerDomain, getMyProfile } from "@/lib/profile";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Settings",
  description: "Manage your WallBang account preferences.",
  path: "/settings",
  noIndex: true,
});

export default async function SettingsPage() {
  if (!featureFlags.playerProfiles) {
    redirect("/");
  }
  if (!isMongoConfigured()) {
    redirect("/?authError=database");
  }

  const user = await getSession();
  if (!user) {
    redirect("/api/auth/steam?returnTo=/settings");
  }

  await ensurePlayerDomain(user);
  const profile = await getMyProfile(user);

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Account preferences for your WallBang player identity.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[14rem_minmax(0,1fr)]">
          <SettingsSidebar />

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>
                  Core account options for your profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Public profile</p>
                    <p className="text-xs text-muted-foreground">
                      View how others see you
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link href="/profile" />}
                  >
                    Open profile
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Theme</p>
                    <p className="text-xs text-muted-foreground">
                      WallBang uses dark theme by default
                    </p>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    Dark
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Coming in a later sprint
                    </p>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    Soon
                  </span>
                </div>

                <div className="rounded-lg border border-border/70 px-4 py-3">
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    SteamID64
                  </p>
                  <p className="mt-1 font-mono text-sm">{user.steamId}</p>
                  {profile ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Display name: {profile.displayName}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delete Account</CardTitle>
                <CardDescription>
                  Account deletion will be available after privacy controls
                  ship.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" size="sm" disabled>
                  Delete account
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
