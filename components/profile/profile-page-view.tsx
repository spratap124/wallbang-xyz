"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { Achievements } from "@/components/profile/achievements";
import { ActivityCard } from "@/components/profile/activity-card";
import { ActivityTimeline } from "@/components/profile/activity-timeline";
import { CurrentServerCard } from "@/components/profile/current-server-card";
import { MapCard } from "@/components/profile/map-card";
import { PlayerSummary } from "@/components/profile/player-summary";
import { ProfileBanner } from "@/components/profile/profile-banner";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileStats } from "@/components/profile/profile-stats";
import {
  PROFILE_TABS,
  ProfileTabs,
  type ProfileTabId,
} from "@/components/profile/profile-tabs";
import { WeaponCard } from "@/components/profile/weapon-card";
import { Container } from "@/components/shared/primitives";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PlayerProfileView } from "@/types/profile";

type ActivityItem = {
  id: string;
  type?: string;
  title: string;
  description: string | null;
  createdAt: string;
};

type ProfilePageViewProps = {
  profile: PlayerProfileView;
  activity: ActivityItem[];
  activityPrivate?: boolean;
};

function isActiveTab(tab: string | null): ProfileTabId {
  const ids = PROFILE_TABS.map((t) => t.id);
  if (tab && (ids as string[]).includes(tab)) {
    const found = PROFILE_TABS.find((t) => t.id === tab);
    if (found && !found.comingSoon) return found.id;
  }
  return "overview";
}

function ProfileTabBody({
  profile,
  activity,
  activityPrivate,
  tab,
}: ProfilePageViewProps & { tab: ProfileTabId }) {
  if (tab === "activity") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Timeline of WallBang milestones and events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityPrivate ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                This player&apos;s activity is private.
              </p>
            </div>
          ) : (
            <ActivityTimeline items={activity} />
          )}
        </CardContent>
      </Card>
    );
  }

  if (tab === "achievements") {
    return <Achievements badges={profile.badges} />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <ProfileStats stats={profile.stats} />
        <div className="grid gap-6 sm:grid-cols-2">
          <WeaponCard weapon={profile.summary.favoriteWeapon} />
          <MapCard favoriteMap={profile.summary.favoriteMap} />
        </div>
        {!activityPrivate ? <ActivityCard items={activity.slice(0, 5)} /> : null}
      </div>

      <aside className="space-y-6">
        <PlayerSummary profile={profile} />
        <CurrentServerCard server={profile.summary.currentServer} />
        <Achievements badges={profile.badges} />
      </aside>
    </div>
  );
}

function ProfilePageInner({
  profile,
  activity,
  activityPrivate,
}: ProfilePageViewProps) {
  const searchParams = useSearchParams();
  const tab = useMemo(
    () => isActiveTab(searchParams.get("tab")),
    [searchParams],
  );

  return (
    <div className="pb-16">
      <ProfileBanner bannerUrl={profile.bannerUrl} />
      <Container className="space-y-8">
        <ProfileHeader profile={profile} />
        <ProfileTabs
          steamId={profile.steamId}
          isOwner={profile.isOwner}
          activeTab={tab}
        />
        <ProfileTabBody
          profile={profile}
          activity={activity}
          activityPrivate={activityPrivate}
          tab={tab}
        />
      </Container>
    </div>
  );
}

export function ProfilePageView(props: ProfilePageViewProps) {
  return (
    <Suspense
      fallback={
        <div className="pb-16">
          <ProfileBanner bannerUrl={props.profile.bannerUrl} />
          <Container className="space-y-8">
            <ProfileHeader profile={props.profile} />
            <div className="h-11 border-b border-border" aria-hidden />
          </Container>
        </div>
      }
    >
      <ProfilePageInner {...props} />
    </Suspense>
  );
}
