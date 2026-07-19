"use client";

import { cn } from "@/lib/utils";

type StatTrakToggleProps = {
  enabled: boolean;
  supported: boolean;
  onChange: (value: boolean) => void;
  className?: string;
};

export function StatTrakToggle({
  enabled,
  supported,
  onChange,
  className,
}: StatTrakToggleProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          StatTrak™
        </p>
        {!supported ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Not available for this skin
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={!supported}
        onClick={() => onChange(!enabled)}
        className={cn(
          "relative inline-flex h-7 w-[4.25rem] items-center rounded-full px-1 text-[10px] font-semibold tracking-wide uppercase transition-colors",
          enabled ? "bg-orange-500/90 text-white" : "bg-secondary text-muted-foreground",
          !supported && "cursor-not-allowed opacity-40",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform",
            enabled && "translate-x-[2.15rem]",
          )}
        />
        <span className={cn("relative z-[1] w-full text-center", enabled ? "pr-5" : "pl-5")}>
          {enabled ? "On" : "Off"}
        </span>
      </button>
    </div>
  );
}
