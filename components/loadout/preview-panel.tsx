"use client";

import { Check, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FavoriteButton, SkinImage } from "@/components/loadout/skin-image";
import { StatTrakToggle } from "@/components/loadout/stattrak-toggle";
import { WearSlider } from "@/components/loadout/wear-slider";
import { RARITY_COLORS, groupTypeLabel } from "@/lib/loadout/constants";
import { resolveDefaultWeaponImage } from "@/lib/loadout/images";
import { cn } from "@/lib/utils";
import type { EquippedItem, Skin, WeaponGroup } from "@/types/loadout";

type PreviewPanelProps = {
  weaponName: string | null;
  weaponId?: string | null;
  weaponDefIndex?: number;
  weaponGroup?: WeaponGroup | string;
  preview: EquippedItem | null;
  draftSkin: Skin | null;
  wear: number;
  seed: number;
  stattrak: boolean;
  isFavorite: boolean;
  canEquip: boolean;
  isEquipped: boolean;
  onWearChange: (wear: number) => void;
  onSeedChange: (seed: number) => void;
  onStatTrakChange: (value: boolean) => void;
  onEquip: () => void;
  onBrowseSkins?: () => void;
  onToggleFavorite: () => void;
  className?: string;
};

export function PreviewPanel({
  weaponName,
  weaponId,
  weaponDefIndex,
  weaponGroup,
  preview,
  draftSkin,
  wear,
  seed,
  stattrak,
  isFavorite,
  canEquip,
  isEquipped,
  onWearChange,
  onSeedChange,
  onStatTrakChange,
  onEquip,
  onBrowseSkins,
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
  const rarityColor = RARITY_COLORS[rarity];
  const typeLabel = weaponGroup ? groupTypeLabel(weaponGroup) : "";

  async function handleShare() {
    const label =
      skinName && weaponName ? `${weaponName} | ${skinName}` : weaponName;
    if (!label) return;
    try {
      await navigator.clipboard.writeText(label);
    } catch {
      /* ignore */
    }
  }

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
        "flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Preview
        </p>
        <div className="flex items-center gap-0.5">
          {draftSkin || preview ? (
            <FavoriteButton active={isFavorite} onToggle={onToggleFavorite} />
          ) : null}
          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label="Copy skin name"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Share2 className="size-4" />
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-heading text-xl font-semibold tracking-tight">
          {skinName ? `${weaponName} | ${skinName}` : weaponName}
        </h3>
        <p className="mt-1 text-sm" style={{ color: rarityColor }}>
          {rarity}
          {typeLabel ? ` ${typeLabel}` : ""}
        </p>
        <div
          className="mt-2 h-0.5 w-16 rounded-full"
          style={{ backgroundColor: rarityColor }}
        />
      </div>

      <SkinImage
        name={skinName ?? weaponName ?? "Default"}
        rarity={rarity}
        image={previewImage}
        size="2xl"
        alt={
          skinName && weaponName
            ? `${weaponName} | ${skinName}`
            : (weaponName ?? "Skin preview")
        }
      />

      <WearSlider
        label="Exterior"
        value={wear}
        onChange={onWearChange}
        disabled={!wearSupported}
      />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Pattern seed
          </p>
          <p className="text-[11px] text-muted-foreground">0 – 999</p>
        </div>
        <input
          type="number"
          min={0}
          max={999}
          value={seed}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            onSeedChange(Math.max(0, Math.min(999, Math.floor(next))));
          }}
          className="h-8 w-20 rounded-lg border border-input bg-transparent px-2 text-right font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Pattern seed"
        />
      </div>

      <StatTrakToggle
        enabled={stattrak}
        supported={!!stSupported || !!draftSkin?.stattrakSupported}
        onChange={onStatTrakChange}
      />

      {onBrowseSkins ? (
        <Button variant="outline" className="w-full" onClick={onBrowseSkins}>
          Browse skins
        </Button>
      ) : null}

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
