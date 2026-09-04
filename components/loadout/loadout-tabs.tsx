"use client";

import {
  Crosshair,
  Focus,
  Hand,
  LayoutGrid,
  Shield,
  Sword,
  Target,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { LoadoutTab } from "@/types/loadout";

export const LOADOUT_TABS: {
  id: LoadoutTab;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "pistols", label: "Pistols", icon: Target },
  { id: "smgs", label: "SMGs", icon: Zap },
  { id: "rifles", label: "Rifles", icon: Crosshair },
  { id: "heavy", label: "Heavy", icon: Shield },
  { id: "snipers", label: "Snipers", icon: Focus },
  { id: "knives", label: "Knife", icon: Sword },
  { id: "gloves", label: "Gloves", icon: Hand },
  { id: "agents", label: "Agent", icon: User },
];

type LoadoutTabsProps = {
  active: LoadoutTab;
  onChange: (tab: LoadoutTab) => void;
};

export function LoadoutTabs({ active, onChange }: LoadoutTabsProps) {
  return (
    <nav
      aria-label="Loadout categories"
      className="-mx-0.5 flex gap-1 overflow-x-auto px-0.5 py-1"
    >
      {LOADOUT_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
