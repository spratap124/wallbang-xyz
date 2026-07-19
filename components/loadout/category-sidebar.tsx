"use client";

import {
  Crosshair,
  Hand,
  Music,
  Paintbrush,
  Pin,
  Star,
  Sword,
  User,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { LOADOUT_CATEGORIES } from "@/lib/loadout/constants";
import type { LoadoutCategory } from "@/types/loadout";

const ICONS: Record<string, LucideIcon> = {
  Crosshair,
  Sword,
  Hand,
  User,
  Star,
  Music,
  Paintbrush,
  Pin,
};

type CategorySidebarProps = {
  active: LoadoutCategory;
  onChange: (category: LoadoutCategory) => void;
  className?: string;
};

export function CategorySidebar({
  active,
  onChange,
  className,
}: CategorySidebarProps) {
  return (
    <nav
      aria-label="Loadout categories"
      className={cn(
        "flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0",
        className,
      )}
    >
      {LOADOUT_CATEGORIES.map((cat) => {
        const Icon = ICONS[cat.icon] ?? Crosshair;
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            disabled={cat.comingSoon}
            onClick={() => onChange(cat.id)}
            className={cn(
              "group flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
              "lg:w-full",
              isActive
                ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              cat.comingSoon && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            <span className="font-medium whitespace-nowrap">{cat.label}</span>
            {cat.comingSoon ? (
              <span className="ml-auto hidden text-[10px] tracking-wide text-muted-foreground uppercase lg:inline">
                Soon
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
