import { Suspense } from "react";

import { Achievements } from "@/components/profile/achievements";
import { ActivityCard } from "@/components/profile/activity-card";
import { CurrentServerCard } from "@/components/profile/current-server-card";
import { MapCard } from "@/components/profile/map-card";
import { PlayerSummary } from "@/components/profile/player-summary";
import { ProfileBanner } from "@/components/profile/profile-banner";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileStats } from "@/components/profile/profile-stats";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { WeaponCard } from "@/components/profile/weapon-card";
import { Container } from "@/components/shared/primitives";
import type { PlayerProfileView } from "@/types/profile";

type ProfilePageViewProps = {
  profile: PlayerProfileView;
  activity: Array<{
    id: string;
    title: string;
    description: string | null;
    createdAt: string;
  }>;
};

export function ProfilePageView({ profile, activity }: ProfilePageViewProps) {
  return (
    <div className="pb-16">
      <ProfileBanner bannerUrl={profile.bannerUrl} />
      <Container className="space-y-8">
        <ProfileHeader profile={profile} />

        <Suspense
          fallback={
            <div className="h-11 border-b border-border" aria-hidden />
          }
        >
          <ProfileTabs steamId={profile.steamId} isOwner={profile.isOwner} />
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <ProfileStats stats={profile.stats} />
            <div className="grid gap-6 sm:grid-cols-2">
              <WeaponCard weapon={profile.summary.favoriteWeapon} />
              <MapCard favoriteMap={profile.summary.favoriteMap} />
            </div>
            <ActivityCard items={activity} />
          </div>

          <aside className="space-y-6">
            <PlayerSummary profile={profile} />
            <CurrentServerCard
              serverName={profile.summary.currentServer}
            />
            <Achievements badges={profile.badges} />
          </aside>
        </div>
      </Container>
    </div>
  );
}
