import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMonthYear, formatRelativeTime, formatStatValue } from "@/lib/profile/format";
import { roleDisplayName } from "@/lib/profile/badges";
import type { PlayerProfileView } from "@/types/profile";

type PlayerSummaryCardProps = {
  profile: PlayerProfileView;
};

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-right font-mono text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function PlayerSummary({ profile }: PlayerSummaryCardProps) {
  const { summary } = profile;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Player Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <dl>
          <SummaryRow label="SteamID64" value={summary.steamId} />
          <SummaryRow
            label="Member Since"
            value={formatMonthYear(summary.memberSince)}
          />
          <SummaryRow
            label="Last Login"
            value={formatRelativeTime(summary.lastLoginAt)}
          />
          <SummaryRow label="Role" value={roleDisplayName(summary.role)} />
          <SummaryRow
            label="Profile Completion"
            value={`${summary.profileCompletion}%`}
          />
          <SummaryRow
            label="Current Server"
            value={summary.currentServer ?? "Offline"}
          />
          <SummaryRow
            label="Favorite Weapon"
            value={summary.favoriteWeapon ?? "—"}
          />
          <SummaryRow
            label="Favorite Map"
            value={summary.favoriteMap ?? "—"}
          />
          <SummaryRow
            label="Preferred Side"
            value={summary.preferredSide ?? "—"}
          />
          <SummaryRow
            label="Profile Views"
            value={formatStatValue(profile.profileViews)}
          />
        </dl>
      </CardContent>
    </Card>
  );
}
