import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type WeaponCardProps = {
  weapon?: string | null;
  usagePercent?: number | null;
  kills?: number | null;
  hsPercent?: number | null;
};

export function WeaponCard({
  weapon,
  usagePercent,
  kills,
  hsPercent,
}: WeaponCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Favorite Weapon</CardTitle>
      </CardHeader>
      <CardContent>
        {weapon ? (
          <div className="space-y-2">
            <p className="text-xl font-semibold">{weapon}</p>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {usagePercent != null ? <span>{usagePercent}% usage</span> : null}
              {kills != null ? <span>{kills} kills</span> : null}
              {hsPercent != null ? <span>{hsPercent}% HS</span> : null}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Play matches to unlock weapon stats
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
