import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/profile/format";

export type ActivityItem = {
  id: string;
  title: string;
  description?: string | null;
  createdAt: string;
};

type ActivityCardProps = {
  items: ActivityItem[];
};

export function ActivityCard({ items }: ActivityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="border-b border-border/50 pb-3 last:border-0 last:pb-0"
              >
                <p className="text-sm font-medium">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
                <p className="mt-1 font-mono text-[0.7rem] text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
