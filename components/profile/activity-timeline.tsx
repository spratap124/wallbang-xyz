import { formatMonthYear, formatRelativeTime } from "@/lib/profile/format";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  type?: string;
  title: string;
  description?: string | null;
  createdAt: string;
};

type ActivityTimelineProps = {
  items: TimelineItem[];
  className?: string;
};

export function ActivityTimeline({ items, className }: ActivityTimelineProps) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border bg-muted/30 px-4 py-10 text-center",
          className,
        )}
      >
        <p className="font-medium text-foreground">No activity yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Play matches, earn badges, and your timeline will fill in.
        </p>
      </div>
    );
  }

  return (
    <ol className={cn("relative space-y-0", className)}>
      {items.map((item, index) => {
        const date = new Date(item.createdAt);
        const isFirstOfMonth =
          index === 0 ||
          formatMonthYear(items[index - 1]!.createdAt) !==
            formatMonthYear(item.createdAt);

        return (
          <li key={item.id}>
            {isFirstOfMonth ? (
              <p className="mb-3 mt-6 first:mt-0 font-mono text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase">
                {formatMonthYear(item.createdAt)}
              </p>
            ) : null}
            <div className="relative flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-background" />
                {index < items.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-border" aria-hidden />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <time
                    dateTime={date.toISOString()}
                    className="font-mono text-[0.7rem] text-muted-foreground"
                    title={date.toLocaleString()}
                  >
                    {formatRelativeTime(item.createdAt)}
                  </time>
                </div>
                {item.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
