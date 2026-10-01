import { ExternalLink } from "lucide-react";
import Image from "next/image";

import { VipBadge } from "@/components/profile/vip-badge";
import { Button } from "@/components/ui/button";
import type { PlayerProfileView } from "@/types/profile";

type ProfileHeroProps = {
  profile: PlayerProfileView;
  isVip: boolean;
  joinedLabel: string;
};

export function ProfileHero({ profile, isVip, joinedLabel }: ProfileHeroProps) {
  const steamName =
    profile.displayName !== profile.personaName ? profile.personaName : null;

  return (
    <section className="border-border bg-card relative overflow-hidden rounded-xl border">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src="/profile-banner.jpg"
          alt=""
          fill
          priority
          unoptimized
          sizes="(min-width: 1152px) 1088px, 100vw"
          className="object-cover object-[72%_center]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(11,13,16,0.88) 0%, rgba(11,13,16,0.62) 24%, rgba(11,13,16,0.18) 46%, rgba(11,13,16,0) 64%)",
          }}
        />
      </div>

      <div className="relative flex min-h-[12.75rem] items-center gap-4 p-4 sm:min-h-[16.5rem] sm:gap-5 sm:p-5">
        <div className="ring-primary size-16 shrink-0 overflow-hidden rounded-full ring-2 sm:size-20">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Steam CDN avatars
            <img
              src={profile.avatarUrl}
              alt=""
              width={80}
              height={80}
              className="size-full object-cover"
            />
          ) : (
            <div className="bg-secondary flex size-full items-center justify-center text-xl font-semibold">
              {profile.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="max-w-lg min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {profile.displayName}
            </h1>
            {isVip ? <VipBadge /> : null}
          </div>

          <p className="text-muted-foreground mt-1 truncate text-sm">
            Steam Player
            {steamName ? (
              <span className="text-foreground/80"> · {steamName}</span>
            ) : null}
          </p>
          {joinedLabel ? (
            <p className="text-muted-foreground truncate text-sm">
              Joined WallBang {joinedLabel}
            </p>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            className="bg-background/40 mt-3"
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
        </div>
      </div>
    </section>
  );
}
