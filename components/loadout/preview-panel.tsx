"use client";

import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FavoriteButton, SkinImage } from "@/components/loadout/skin-image";
import { StatTrakToggle } from "@/components/loadout/stattrak-toggle";
import { WearSlider } from "@/components/loadout/wear-slider";
import { resolveDefaultWeaponImage } from "@/lib/loadout/images";
import { cn } from "@/lib/utils";
import type { EquippedItem, Skin } from "@/types/loadout";

type PreviewPanelProps = {
  weaponName: string | null;
  weaponId?: string | null;
  weaponDefIndex?: number;
  preview: EquippedItem | null;
  draftSkin: Skin | null;
  wear: number;
  stattrak: boolean;
  isFavorite: boolean;
  canEquip: boolean;
  isEquipped: boolean;
  onWearChange: (wear: number) => void;
  onStatTrakChange: (value: boolean) => void;
  onEquip: () => void;
  onToggleFavorite: () => void;
  className?: string;
};

export function PreviewPanel({
  weaponName,
  weaponId,
  weaponDefIndex,
  preview,
  draftSkin,
  wear,
  stattrak,
  isFavorite,
  canEquip,
  isEquipped,
  onWearChange,
  onStatTrakChange,
  onEquip,
  onToggleFavorite,
  className,
}: PreviewPanelProps) {
  const skinName = draftSkin?.skinName ?? preview?.skinName ?? null;
  const rarity = draftSkin?.rarity ?? preview?.rarity ?? "Consumer Grade";
  const wearSupported = draftSkin?.wearSupported ?? preview != null;
  const stSupported =
    draftSkin?.stattrakSupported ?? preview?.stattrak ?? false;
  const previewImage =
    draftSkin?.image ??
    preview?.image ??
    (weaponName || weaponId
      ? resolveDefaultWeaponImage({
          id: weaponId,
          defIndex: weaponDefIndex,
          name: weaponName,
        })
      : undefined);

  if (!weaponName) {
    return (
      <aside
        className={cn(
          "hidden rounded-xl bg-card/60 p-6 ring-1 ring-foreground/10 xl:block",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">
          Select a weapon, knife, or gloves to preview and equip skins.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Preview
          </p>
          <h3 className="mt-1 truncate font-heading text-lg font-semibold">
            {weaponName}
          </h3>
        </div>
        {draftSkin || preview ? (
          <FavoriteButton
            active={isFavorite}
            onToggle={onToggleFavorite}
          />
        ) : null}
      </div>

      <SkinImage
        name={skinName ?? weaponName ?? "Default"}
        rarity={rarity}
        image={previewImage}
        size="xl"
        alt={
          skinName && weaponName
            ? `${weaponName} | ${skinName}`
            : (weaponName ?? "Skin preview")
        }
      />

      <div className="space-y-1">
        <p className="font-heading text-base font-semibold">
          {skinName ?? "No skin selected"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{rarity}</Badge>
          {stattrak && stSupported ? (
            <Badge
              variant="outline"
              className="border-orange-500/40 text-orange-400"
            >
              StatTrak™
            </Badge>
          ) : null}
        </div>
        {draftSkin?.collection || preview ? (
          <p className="text-xs text-muted-foreground">
            {draftSkin?.collection ?? "Equipped"}
            {" · "}
            Pattern seed {preview?.seed ?? 661}
          </p>
        ) : null}
      </div>

      <WearSlider
        value={wear}
        onChange={onWearChange}
        disabled={!wearSupported}
      />

      <StatTrakToggle
        enabled={stattrak}
        supported={!!stSupported || !!draftSkin?.stattrakSupported}
        onChange={onStatTrakChange}
      />

      <Button
        className="mt-auto w-full"
        size="lg"
        disabled={!canEquip || isEquipped}
        onClick={onEquip}
      >
        {isEquipped ? (
          <>
            <Check data-icon="inline-start" />
            Equipped
          </>
        ) : (
          "Equip Skin"
        )}
      </Button>
    </aside>
  );
}
