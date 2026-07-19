import { redirect } from "next/navigation";

import { PrivacySettingsForm } from "@/components/profile/privacy-settings-form";
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
import { ensurePlayerDomain, getMyProfile } from "@/lib/profile";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Privacy Settings",
  description: "Control who can see your WallBang profile data.",
  path: "/settings/privacy",
  noIndex: true,
});

export default async function PrivacySettingsPage() {
  if (!featureFlags.playerProfiles) {
    redirect("/");
  }
  if (!isMongoConfigured()) {
    redirect("/?authError=database");
  }

  const user = await getSession();
  if (!user) {
    redirect("/api/auth/steam?returnTo=/settings/privacy");
  }

  await ensurePlayerDomain(user);
  const profile = await getMyProfile(user);
  if (!profile) {
    redirect("/settings");
  }

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
          <p className="mt-2 text-muted-foreground">
            Choose Public, Friends Only, or Private for each section.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[14rem_minmax(0,1fr)]">
          <SettingsSidebar />

          <Card>
            <CardHeader>
              <CardTitle>Visibility</CardTitle>
              <CardDescription>
                Changes apply immediately to your public profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PrivacySettingsForm initial={profile.privacy} />
            </CardContent>
          </Card>
        </div>
      </Container>
    </div>
  );
}
