import { redirect } from "next/navigation";

import { ProfilePageView } from "@/components/profile/profile-page-view";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { isProfilePageEnabled, isSettingsPageEnabled } from "@/lib/platform/feature-flags";
import {
  ensurePlayerDomain,
  getMyProfile,
  getPlayerActivity,
} from "@/lib/profile";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "My Profile",
  description: "Your WallBang player profile — identity, stats, and badges.",
  path: "/profile",
  noIndex: true,
});

export default async function MyProfilePage() {
  if (!(await isProfilePageEnabled())) {
    redirect("/");
  }

  if (!isMongoConfigured()) {
    redirect("/?authError=database");
  }

  const user = await getSession();
  if (!user) {
    redirect("/api/auth/steam?returnTo=/profile");
  }

  await ensurePlayerDomain(user);
  const profile = await getMyProfile(user);
  if (!profile) {
    redirect("/");
  }

  const activityDocs = await getPlayerActivity(user.steamId, 40);
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
      activityPrivate={false}
      showSettings={showSettings}
    />
  );
}
