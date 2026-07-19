import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BadgeList } from "@/components/profile/badge-list";
import type { ProfileBadge } from "@/types/profile";

type AchievementsProps = {
  badges: ProfileBadge[];
};

export function Achievements({ badges }: AchievementsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Achievements</CardTitle>
      </CardHeader>
      <CardContent>
        <BadgeList
          badges={badges}
          emptyLabel="No badges yet — keep playing to unlock more."
        />
      </CardContent>
    </Card>
  );
}
