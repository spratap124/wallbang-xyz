"use client";

import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FavoriteButton, SkinImage } from "@/components/loadout/skin-image";
import { RARITY_COLORS } from "@/lib/loadout/constants";
import { cn } from "@/lib/utils";
import type { Skin } from "@/types/loadout";

type SkinCardProps = {
  skin: Skin;
  isEquipped: boolean;
  isFavorite: boolean;
  selected?: boolean;
  onSelect: () => void;
  onEquip: () => void;
  onToggleFavorite: () => void;
};

export function SkinCard({
  skin,
  isEquipped,
  isFavorite,
  selected = false,
  onSelect,
  onEquip,
  onToggleFavorite,
}: SkinCardProps) {
  const rarityColor = RARITY_COLORS[skin.rarity];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group flex cursor-pointer flex-col overflow-hidden rounded-xl bg-card text-left ring-1 ring-foreground/10 transition-all",
        "hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected && "ring-primary/50",
        isEquipped && "ring-primary/35",
      )}
    >
      <div className="relative">
        <SkinImage
          name={skin.skinName}
          rarity={skin.rarity}
          image={skin.image}
          size="md"
          className="rounded-none"
          alt={`${skin.weapon} | ${skin.skinName}`}
        />
        <FavoriteButton
          active={isFavorite}
          onToggle={onToggleFavorite}
          className="absolute top-1.5 right-1.5 bg-background/70 backdrop-blur-sm"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold">
            {skin.skinName}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {skin.collection}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge
            variant="outline"
            style={{
              borderColor: `${rarityColor}66`,
              color: rarityColor,
            }}
          >
            {skin.rarity}
          </Badge>
          {skin.stattrakSupported ? (
            <Badge variant="outline" className="border-orange-500/40 text-orange-400">
              ST
            </Badge>
          ) : null}
        </div>
        <Button
          size="sm"
          variant={isEquipped ? "secondary" : "default"}
          className="mt-auto w-full"
          disabled={isEquipped}
          onClick={(e) => {
            e.stopPropagation();
            onEquip();
          }}
        >
          {isEquipped ? (
            <>
              <Check data-icon="inline-start" />
              Equipped
            </>
          ) : (
            "Equip"
          )}
        </Button>
      </div>
    </div>
  );
}
