import type { ProfileBadge } from "@/types/profile";

import { ProfileBadgeChip } from "@/components/profile/vip-badge";

type BadgeListProps = {
  badges: ProfileBadge[];
  emptyLabel?: string;
};

export function BadgeList({
  badges,
  emptyLabel = "No badges yet",
}: BadgeListProps) {
  if (badges.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <li key={badge.type}>
          <ProfileBadgeChip type={badge.type} label={badge.label} />
        </li>
      ))}
    </ul>
  );
}
