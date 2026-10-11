import { notFound, redirect } from "next/navigation";

import { ProfilePageView } from "@/components/profile/profile-page-view";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { isProfilePageEnabled } from "@/lib/platform/feature-flags";
import { getPlayerProfile, isValidSteamId64, loadPlayerProfilePage } from "@/lib/profile";
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
    // In-game-only players have a staff-only profile built from game data:
    // never index it and never advertise a persona we do not have.
    return createPageMetadata({
      title: "Player profile",
      description:
        "SteamID64 profile for a Counter-Strike 2 player seen on WallBang servers.",
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
  // Registered players are public; players with no WallBang account are
  // staff-only (admins, owners, moderators). Everyone else gets a 404.
  const page = await loadPlayerProfilePage({ steamId, viewer });
  if (!page) {
    notFound();
  }

  return (
    <ProfilePageView profile={page.profile} dashboard={page.dashboard} />
  );
}
