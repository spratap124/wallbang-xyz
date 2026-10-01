import { notFound, redirect } from "next/navigation";

import { ProfilePageView } from "@/components/profile/profile-page-view";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { isProfilePageEnabled } from "@/lib/platform/feature-flags";
import { getProfileDashboard } from "@/lib/profile/dashboard";
import { getPlayerProfile, isValidSteamId64 } from "@/lib/profile";
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

  const dashboard = await getProfileDashboard({
    userId: profile.userId,
    steamId: profile.steamId,
    fallbackVip: profile.isVip,
    joinedAt: profile.joinedAt,
  });

  return <ProfilePageView profile={profile} dashboard={dashboard} />;
}
