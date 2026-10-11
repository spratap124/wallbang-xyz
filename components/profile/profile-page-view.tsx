"use client";

import Link from "next/link";

import { CopySteamIdButton } from "@/components/profile/copy-steam-id-button";
import { CurrentServerCard } from "@/components/profile/current-server-card";
import { LoadoutPreview } from "@/components/profile/loadout-preview";
import { ModerationRecords } from "@/components/profile/moderation-records";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfileStats } from "@/components/profile/profile-stats";
import { RetakeServerList } from "@/components/profile/retake-server-list";
import { ServerActivityCard } from "@/components/profile/server-activity-card";
import { VipMembershipCard } from "@/components/profile/vip-membership-card";
import {
  LiveServersProvider,
  useLiveServers,
} from "@/components/servers/live-servers-provider";
import { Container } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProfilePageProfile } from "@/types/profile";
import type { ProfileDashboardExtras } from "@/types/profile-dashboard";

type ProfilePageViewProps = {
  profile: ProfilePageProfile;
  dashboard: ProfileDashboardExtras;
};

function StatsSection({ profile }: { profile: ProfilePageProfile }) {
  if (profile.statsHidden) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-border bg-muted/30 rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-foreground font-medium">Stats are private</p>
            <p className="text-muted-foreground mt-1 text-sm">
              This player has chosen not to share their match statistics
              publicly.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <ProfileStats stats={profile.stats} />;
}

function ProfileDashboard({ profile, dashboard }: ProfilePageViewProps) {
  const { servers, hasLoaded } = useLiveServers();

  return (
    <div className="pb-16">
      <Container className="space-y-4 py-6 sm:space-y-5 sm:py-8">
        <ProfileHero
          profile={profile}
          isVip={dashboard.vip.active}
          joinedLabel={dashboard.joinedLabel}
        />

        {profile.showSteamId ? (
          <div className="border-border bg-card/40 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              SteamID64
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate font-mono text-sm">
                {profile.steamId}
              </span>
              <CopySteamIdButton steamId={profile.steamId} />
            </span>
          </div>
        ) : null}

        {profile.isOwner ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-muted-foreground text-xs">
              This is how other players see your public profile.
            </p>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/profile/${profile.steamId}`} />}
            >
              View public profile
            </Button>
          </div>
        ) : null}

        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <StatsSection profile={profile} />
          <ServerActivityCard activity={profile.serverActivity ?? null} />
        </div>

        <div
          className={cn(
            "grid items-stretch gap-4",
            profile.isOwner && "lg:grid-cols-2",
          )}
        >
          {profile.isOwner ? (
            <VipMembershipCard vip={dashboard.vip} isOwner={profile.isOwner} />
          ) : null}
          <CurrentServerCard
            server={profile.summary.currentServer}
            serverMeta={dashboard.serverMeta}
            liveServers={servers}
          />
        </div>

        <RetakeServerList servers={servers} hasLoaded={hasLoaded} />
        <LoadoutPreview
          loadout={dashboard.loadout}
          isOwner={profile.isOwner}
          displayName={profile.displayName}
        />

        {/* Reserved for the future public bans ledger — renders no ban data. */}
        <ModerationRecords />
      </Container>
    </div>
  );
}

export function ProfilePageView(props: ProfilePageViewProps) {
  return (
    <LiveServersProvider>
      <ProfileDashboard {...props} />
    </LiveServersProvider>
  );
}
