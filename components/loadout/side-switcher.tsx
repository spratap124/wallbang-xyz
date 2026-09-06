"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";
import type { LoadoutSide } from "@/types/loadout";

type SideSwitcherProps = {
  side: LoadoutSide;
  onChange: (side: LoadoutSide) => void;
};

export function SideSwitcher({ side, onChange }: SideSwitcherProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-8">
      <button
        type="button"
        onClick={() => onChange("CT")}
        className={cn(
          "flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all",
          side === "CT"
            ? "border-sky-400 bg-sky-500/15 shadow-[0_0_28px_rgba(56,189,248,0.28)]"
            : "border-transparent bg-card ring-1 ring-foreground/10 hover:ring-sky-400/30",
        )}
      >
        <span
          className={cn(
            "relative size-14 shrink-0 overflow-hidden rounded-full",
            side === "CT" ? "ring-2 ring-sky-400/80" : "opacity-70",
          )}
        >
          <Image
            src="/loadout/ct-side.jpg"
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        </span>
        <span>
          <span className="block text-lg font-semibold tracking-tight">CT SIDE</span>
          <span className="text-xs tracking-wide text-muted-foreground uppercase">
            Counter-Terrorist
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => onChange("T")}
        className={cn(
          "flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all",
          side === "T"
            ? "border-amber-400 bg-amber-500/15 shadow-[0_0_28px_rgba(251,191,36,0.28)]"
            : "border-transparent bg-card ring-1 ring-foreground/10 hover:ring-amber-400/30",
        )}
      >
        <span
          className={cn(
            "relative size-14 shrink-0 overflow-hidden rounded-full",
            side === "T" ? "ring-2 ring-amber-400/80" : "opacity-70",
          )}
        >
          <Image
            src="/loadout/t-side.jpg"
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        </span>
        <span>
          <span className="block text-lg font-semibold tracking-tight">T SIDE</span>
          <span className="text-xs tracking-wide text-muted-foreground uppercase">
            Terrorist
          </span>
        </span>
      </button>
    </div>
  );
}
