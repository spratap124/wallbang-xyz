"use client";

import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SkinImage } from "@/components/loadout/skin-image";
import {
  resolveAnySkinImage,
  resolveSkinImage,
  resolveSkinImageByName,
} from "@/lib/loadout/images";
import { cn } from "@/lib/utils";
import type { EquippedItem } from "@/types/loadout";

type WeaponCardProps = {
  name: string;
  weaponId: string;
  defIndex?: number;
  equipped: EquippedItem | null;
  onClick: () => void;
  selected?: boolean;
  large?: boolean;
};

export function WeaponCard({
  name,
  weaponId,
  defIndex,
  equipped,
  onClick,
  selected = false,
  large = false,
}: WeaponCardProps) {
  const weaponRef = { id: weaponId, defIndex, name };
  const image =
    equipped?.image ??
    (equipped
      ? resolveSkinImage(weaponRef, equipped.paintKit) ??
        resolveSkinImageByName(`${name}|${equipped.skinName}`)
      : undefined) ??
    resolveAnySkinImage(weaponRef);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col overflow-hidden rounded-xl bg-card text-left ring-1 ring-foreground/10 transition-all",
        "hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected && "ring-primary/50",
        large ? "min-h-[11rem]" : "min-h-[9.5rem]",
      )}
    >
      <SkinImage
        name={equipped?.skinName ?? name}
        rarity={equipped?.rarity ?? "Consumer Grade"}
        image={image}
        size={large ? "lg" : "md"}
        className="rounded-none"
        alt={equipped ? `${name} | ${equipped.skinName}` : name}
      />
      <div className="flex flex-1 items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold">{name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {equipped ? equipped.skinName : "No skin equipped"}
          </p>
          {equipped?.stattrak ? (
            <Badge
              variant="outline"
              className="border-orange-500/40 text-orange-400"
            >
              StatTrak™
            </Badge>
          ) : null}
        </div>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </button>
  );
}
