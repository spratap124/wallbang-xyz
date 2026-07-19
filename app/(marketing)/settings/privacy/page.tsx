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
import { ensurePlayerDomain, getMyProfile } from "@/lib/profile";
import { createPageMetadata } from "@/seo/metadata";
import type { PrivacyLevel } from "@/types/profile";

export const metadata = createPageMetadata({
  title: "Privacy Settings",
  description: "Control who can see your WallBang profile data.",
  path: "/settings/privacy",
  noIndex: true,
});

const SECTIONS: Array<{
  key: "stats" | "matchHistory" | "steamInventory" | "activity";
  label: string;
  description: string;
}> = [
  {
    key: "stats",
    label: "Stats",
    description: "Quick stats and detailed performance numbers",
  },
  {
    key: "matchHistory",
    label: "Match History",
    description: "Recent match results and scores",
  },
  {
    key: "steamInventory",
    label: "Steam Inventory",
    description: "Inventory showcase on your profile",
  },
  {
    key: "activity",
    label: "Activity",
    description: "Timeline of profile events",
  },
];

function levelLabel(level: PrivacyLevel): string {
  if (level === "friends") return "Friends Only";
  if (level === "private") return "Private";
  return "Public";
}

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
                Editing controls ship in Sprint 2. Current defaults are shown
                below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {SECTIONS.map((section) => (
                <div
                  key={section.key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{section.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <span className="rounded-md border border-border px-2.5 py-1 font-mono text-xs">
                    {levelLabel(profile.privacy[section.key])}
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
