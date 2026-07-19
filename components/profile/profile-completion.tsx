import Link from "next/link";

import type { ProfileCompletion } from "@/types/profile";
import { cn } from "@/lib/utils";

type ProfileCompletionBarProps = {
  completion: ProfileCompletion;
  className?: string;
  showChecklist?: boolean;
};

export function ProfileCompletionBar({
  completion,
  className,
  showChecklist = true,
}: ProfileCompletionBarProps) {
  const missing = completion.items.filter((i) => !i.done);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          Profile Completion
        </p>
        <p className="font-mono text-sm font-medium">{completion.percent}%</p>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={completion.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${completion.percent}%` }}
        />
      </div>
      {showChecklist && missing.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Finish your profile in{" "}
            <Link href="/settings" className="text-foreground underline-offset-2 hover:underline">
              Settings
            </Link>
          </p>
          <ul className="space-y-0.5">
            {missing.slice(0, 3).map((item) => (
              <li key={item.key} className="text-xs text-muted-foreground">
                · {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
