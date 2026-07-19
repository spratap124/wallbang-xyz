"use client";

import { WEAR_RANGES, wearNameFromFloat } from "@/lib/loadout/constants";
import { cn } from "@/lib/utils";
import type { WearName } from "@/types/loadout";

type WearSliderProps = {
  value: number;
  onChange: (wear: number) => void;
  disabled?: boolean;
  className?: string;
};

export function WearSlider({
  value,
  onChange,
  disabled = false,
  className,
}: WearSliderProps) {
  const current = wearNameFromFloat(value);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Wear
        </span>
        <span className="font-mono text-xs text-foreground">
          {current} · {value.toFixed(4)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
        aria-label="Wear float"
      />
      <div className="flex flex-wrap gap-1">
        {WEAR_RANGES.map((range) => (
          <button
            key={range.name}
            type="button"
            disabled={disabled}
            onClick={() => onChange((range.min + Math.min(range.max, 0.99)) / 2)}
            className={cn(
              "rounded-md px-2 py-1 text-[10px] tracking-wide uppercase transition-colors",
              current === range.name
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              disabled && "pointer-events-none opacity-40",
            )}
          >
            {shortWear(range.name)}
          </button>
        ))}
      </div>
    </div>
  );
}

function shortWear(name: WearName): string {
  switch (name) {
    case "Factory New":
      return "FN";
    case "Minimal Wear":
      return "MW";
    case "Field-Tested":
      return "FT";
    case "Well-Worn":
      return "WW";
    case "Battle-Scarred":
      return "BS";
  }
}
