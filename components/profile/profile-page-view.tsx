"use client";

import { CurrentServerCard } from "@/components/profile/current-server-card";
import { LoadoutPreview } from "@/components/profile/loadout-preview";
import { ProfileHero } from "@/components/profile/profile-hero";
import { RetakeServerList } from "@/components/profile/retake-server-list";
import { VipMembershipCard } from "@/components/profile/vip-membership-card";
import {
  LiveServersProvider,
  useLiveServers,
} from "@/components/servers/live-servers-provider";
import { Container } from "@/components/shared/primitives";
import type { PlayerProfileView } from "@/types/profile";
import type { ProfileDashboardExtras } from "@/types/profile-dashboard";

type ProfilePageViewProps = {
  profile: PlayerProfileView;
  dashboard: ProfileDashboardExtras;
};

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

        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <VipMembershipCard vip={dashboard.vip} isOwner={profile.isOwner} />
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
