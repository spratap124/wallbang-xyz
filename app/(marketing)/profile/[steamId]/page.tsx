import { notFound, redirect } from "next/navigation";

import { ProfilePageView } from "@/components/profile/profile-page-view";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { isProfilePageEnabled, isSettingsPageEnabled } from "@/lib/platform/feature-flags";
import {
  getPlayerActivity,
  getPlayerProfile,
  isValidSteamId64,
} from "@/lib/profile";
import { canViewerAccess } from "@/lib/profile/privacy";
import { createPageMetadata } from "@/seo/metadata";

type PageProps = {
  params: Promise<{ steamId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { steamId } = await params;
  if (!isValidSteamId64(steamId) || !isMongoConfigured()) {
    return createPageMetadata({
      title: "Profile Not Found",
      description: "This WallBang player profile could not be found.",
      path: `/profile/${steamId}`,
      noIndex: true,
    });
  }

  const profile = await getPlayerProfile(steamId, null, {
    incrementViews: false,
  });
  if (!profile) {
    return createPageMetadata({
      title: "Profile Not Found",
      description: "This WallBang player profile could not be found.",
      path: `/profile/${steamId}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: profile.displayName,
    description: `${profile.displayName}'s WallBang player profile.`,
    path: `/profile/${steamId}`,
  });
}

export default async function PublicProfilePage({ params }: PageProps) {
  if (!(await isProfilePageEnabled()) || !isMongoConfigured()) {
    redirect("/");
  }

  const { steamId } = await params;
  if (!isValidSteamId64(steamId)) {
    notFound();
  }

  const viewer = await getSession();
  const profile = await getPlayerProfile(steamId, viewer);
  if (!profile) {
    notFound();
  }

  const canSeeActivity = canViewerAccess(
    profile.privacy.activity,
    profile.isOwner,
  );
  const activityDocs = canSeeActivity
    ? await getPlayerActivity(steamId, 40)
    : [];
  const activity = activityDocs.map((item) => ({
    id: item._id,
    type: item.type,
    title: item.title,
    description: item.description,
    createdAt: item.createdAt.toISOString(),
  }));

  const showSettings = await isSettingsPageEnabled();

  return (
    <ProfilePageView
      profile={profile}
      activity={activity}
      activityPrivate={!canSeeActivity}
      showSettings={showSettings}
    />
  );
}
