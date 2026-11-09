import { redirect } from "next/navigation";

import { ProfilePageView } from "@/components/profile/profile-page-view";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { isProfilePageEnabled } from "@/lib/platform/feature-flags";
import { ensurePlayerDomain, getMyProfile } from "@/lib/profile";
import { createPageMetadata } from "@/seo/metadata";
export const metadata = createPageMetadata({
  title: "My Profile",
  description: "Your WallBang account — VIP membership, retake servers, and loadout.",
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

  // Give the signed-in player's profile the same canonical SteamID URL as
  // every other player profile.
  redirect(`/profile/${encodeURIComponent(profile.steamId)}`);

}
