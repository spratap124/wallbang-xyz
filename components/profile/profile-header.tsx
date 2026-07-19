import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { VipBadge } from "@/components/profile/vip-badge";
import { Button } from "@/components/ui/button";
import {
  countryFlagEmoji,
  formatMonthYear,
  formatRelativeTime,
} from "@/lib/profile/format";
import { roleDisplayName } from "@/lib/profile/badges";
import type { PlayerProfileView } from "@/types/profile";

type ProfileHeaderProps = {
  profile: PlayerProfileView;
};

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const flag = countryFlagEmoji(profile.countryCode);

  return (
    <div className="relative -mt-12 flex flex-col gap-5 px-4 sm:-mt-14 sm:px-6 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-full ring-4 ring-background sm:size-28">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Steam CDN avatars
            <img
              src={profile.avatarUrl}
              alt=""
              width={112}
              height={112}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-secondary text-2xl font-semibold">
              {profile.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-2 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {profile.displayName}
            </h1>
            {profile.showWebsiteBadge || profile.isVip ? <VipBadge /> : null}
          </div>

          {profile.displayName !== profile.personaName ? (
            <p className="text-sm text-muted-foreground">
              Steam: {profile.personaName}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {flag && profile.countryCode ? (
              <span title={profile.countryCode}>
                {flag} {profile.countryCode}
              </span>
            ) : null}
            <span>Joined {formatMonthYear(profile.joinedAt)}</span>
            <span>Last seen {formatRelativeTime(profile.lastLoginAt)}</span>
            <span>{roleDisplayName(profile.role)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pb-1">
        <Button
          variant="outline"
          size="sm"
          render={
            <a
              href={profile.steamProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          View Steam Profile
          <ExternalLink data-icon="inline-end" />
        </Button>
        {profile.isOwner ? (
          <Button variant="secondary" size="sm" render={<Link href="/settings" />}>
            Settings
          </Button>
        ) : null}
      </div>
    </div>
  );
}
