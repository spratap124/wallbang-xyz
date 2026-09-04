"use client";

import { Check } from "lucide-react";

import { FavoriteButton, SkinImage } from "@/components/loadout/skin-image";
import {
  shortWear,
  wearNameFromFloat,
} from "@/lib/loadout/constants";
import {
  resolvePreviewImage,
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
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  muted?: boolean;
};

export function WeaponCard({
  name,
  weaponId,
  defIndex,
  equipped,
  onClick,
  selected = false,
  isFavorite = false,
  onToggleFavorite,
  muted = false,
}: WeaponCardProps) {
  const weaponRef = { id: weaponId, defIndex, name };
  const image =
    equipped?.image ??
    (equipped
      ? (resolveSkinImage(weaponRef, equipped.paintKit) ??
        resolveSkinImageByName(`${name}|${equipped.skinName}`))
      : resolvePreviewImage(weaponRef));

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-xl bg-card text-left ring-1 ring-foreground/10 transition-all",
        "hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected && "ring-primary/60",
      )}
    >
      <div className="relative">
        <SkinImage
          name={equipped?.skinName ?? name}
          rarity={equipped?.rarity ?? "Consumer Grade"}
          image={image}
          size="lg"
          muted={muted}
          className="rounded-none"
          alt={equipped ? `${name} | ${equipped.skinName}` : name}
        />
        {equipped && selected ? (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-sky-500 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
            <Check className="size-3" />
            Equipped
          </span>
        ) : null}
        {onToggleFavorite && equipped ? (
          <FavoriteButton
            active={isFavorite}
            onToggle={onToggleFavorite}
            className="absolute top-1.5 right-1.5 bg-background/70 backdrop-blur-sm"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold">{name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {equipped ? equipped.skinName : "No skin equipped"}
          </p>
        </div>
        {equipped ? <WearMeter wear={equipped.wear} /> : null}
      </div>
    </button>
  );
}

export function WearMeter({ wear }: { wear: number }) {
  const pct = Math.min(100, Math.max(0, wear * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 shrink-0 text-[11px] font-semibold text-muted-foreground">
        {shortWear(wearNameFromFloat(wear))}
      </span>
      <div
        className="relative h-1.5 min-w-0 flex-1 overflow-visible rounded-full"
        style={{
          background:
            "linear-gradient(90deg, #3dd68c 0%, #3dd68c 7%, #4b69ff 7%, #4b69ff 15%, #e8d44d 15%, #e8d44d 38%, #e4ae39 38%, #e4ae39 45%, #eb4b4b 45%, #eb4b4b 100%)",
        }}
      >
        <span
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-black/40"
          style={{ left: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[11px] text-muted-foreground">
        {wear.toFixed(4)}
      </span>
    </div>
  );
}
