import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BadgeType } from "@/types/profile";

type VipBadgeProps = {
  className?: string;
  compact?: boolean;
};

export function VipBadge({ className, compact = false }: VipBadgeProps) {
  return (
    <Badge
      variant="default"
      className={cn(
        "border-primary/40 bg-primary/15 text-primary hover:bg-primary/20",
        className,
      )}
      title="WallBang VIP"
    >
      <Star data-icon="inline-start" className="fill-current" />
      {compact ? "VIP" : "VIP"}
    </Badge>
  );
}

const BADGE_STYLES: Partial<Record<BadgeType, string>> = {
  VIP: "border-primary/40 bg-primary/15 text-primary",
  FOUNDING_MEMBER: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  FOUNDER: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  EARLY_SUPPORTER: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  BETA_TESTER: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  MODERATOR: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  DEVELOPER: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  TOURNAMENT_WINNER: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  CONTENT_CREATOR: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
};

type ProfileBadgeChipProps = {
  type: BadgeType;
  label: string;
  className?: string;
};

export function ProfileBadgeChip({
  type,
  label,
  className,
}: ProfileBadgeChipProps) {
  if (type === "VIP") {
    return <VipBadge className={className} />;
  }

  return (
    <Badge
      variant="outline"
      className={cn(BADGE_STYLES[type], className)}
      title={label}
    >
      {label}
    </Badge>
  );
}
