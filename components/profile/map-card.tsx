import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type MapEntry = {
  name: string;
  percent: number;
};

type MapCardProps = {
  maps?: MapEntry[];
  favoriteMap?: string | null;
};

export function MapCard({ maps, favoriteMap }: MapCardProps) {
  const list =
    maps && maps.length > 0
      ? maps
      : favoriteMap
        ? [{ name: favoriteMap, percent: 0 }]
        : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Favorite Map</CardTitle>
      </CardHeader>
      <CardContent>
        {list.length > 0 ? (
          <ul className="space-y-2">
            {list.map((map) => (
              <li
                key={map.name}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="font-medium">{map.name}</span>
                {map.percent > 0 ? (
                  <span className="font-mono text-muted-foreground">
                    {map.percent}%
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Play matches to unlock map stats
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
