"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/loadout/search-bar";
import { SkinGrid } from "@/components/loadout/skin-grid";
import { SkinImage } from "@/components/loadout/skin-image";
import { DEFAULT_SKIN_FILTERS } from "@/lib/loadout/constants";
import {
  fetchSkinsForWeapon,
  getCollectionsForWeapon,
} from "@/lib/loadout/mock-data";
import { cn } from "@/lib/utils";
import type { EquippedItem, Skin, SkinFilters, SkinRarity } from "@/types/loadout";

type SkinBrowserProps = {
  weaponName: string;
  equipped: EquippedItem | null;
  favorites: string[];
  selectedSkinId: string | null;
  onBack: () => void;
  onSelectSkin: (skin: Skin) => void;
  onEquipSkin: (skin: Skin) => void;
  onToggleFavorite: (skinId: string) => void;
};

const RARITIES: Array<SkinRarity | "all"> = [
  "all",
  "Covert",
  "Contraband",
  "Extraordinary",
  "Classified",
  "Restricted",
  "Mil-Spec",
  "Industrial Grade",
  "Consumer Grade",
];

export function SkinBrowser({
  weaponName,
  equipped,
  favorites,
  selectedSkinId,
  onBack,
  onSelectSkin,
  onEquipSkin,
  onToggleFavorite,
}: SkinBrowserProps) {
  const [skins, setSkins] = useState<Skin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SkinFilters>(DEFAULT_SKIN_FILTERS);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFilters(DEFAULT_SKIN_FILTERS);
    fetchSkinsForWeapon(weaponName).then((data) => {
      if (cancelled) return;
      setSkins(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [weaponName]);

  const collections = useMemo(
    () => getCollectionsForWeapon(weaponName),
    [weaponName],
  );

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return skins.filter((skin) => {
      if (filters.favoritesOnly && !favorites.includes(skin.id)) return false;
      if (filters.rarity !== "all" && skin.rarity !== filters.rarity) return false;
      if (filters.collection !== "all" && skin.collection !== filters.collection)
        return false;
      if (filters.stattrak === "yes" && !skin.stattrakSupported) return false;
      if (filters.stattrak === "no" && skin.stattrakSupported) return false;
      if (filters.souvenir === "yes" && !skin.souvenirSupported) return false;
      if (filters.souvenir === "no" && skin.souvenirSupported) return false;
      if (!q) return true;
      return (
        skin.skinName.toLowerCase().includes(q) ||
        skin.collection.toLowerCase().includes(q) ||
        skin.rarity.toLowerCase().includes(q) ||
        skin.weapon.toLowerCase().includes(q)
      );
    });
  }, [skins, filters, favorites]);

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back to weapons"
            className="mt-0.5 shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Choose skin
            </p>
            <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
              {weaponName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Loading skins…"
                : `${filtered.length} skin${filtered.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        {equipped ? (
          <div className="flex items-center gap-3 rounded-xl bg-card/80 p-2 pr-4 ring-1 ring-foreground/10 sm:max-w-xs">
            <SkinImage
              name={equipped.skinName}
              rarity={equipped.rarity}
              image={equipped.image}
              size="sm"
              className="w-20 shrink-0 rounded-lg"
              alt={`${weaponName} | ${equipped.skinName}`}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Equipped
              </p>
              <p className="truncate text-sm font-semibold">{equipped.skinName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {equipped.wearName}
                {equipped.stattrak ? " · StatTrak™" : ""}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-card/40 p-3 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:flex-wrap">
        <SearchBar
          value={filters.search}
          onChange={(search) => setFilters((f) => ({ ...f, search }))}
          className="sm:min-w-[14rem] sm:flex-1"
        />
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label="Rarity"
            value={filters.rarity}
            options={RARITIES.map((r) => ({
              value: r,
              label: r === "all" ? "All rarities" : r,
            }))}
            onChange={(rarity) =>
              setFilters((f) => ({
                ...f,
                rarity: rarity as SkinFilters["rarity"],
              }))
            }
          />
          <FilterSelect
            label="Collection"
            value={filters.collection}
            options={[
              { value: "all", label: "All collections" },
              ...collections.map((c) => ({ value: c, label: c })),
            ]}
            onChange={(collection) =>
              setFilters((f) => ({ ...f, collection }))
            }
          />
          <FilterSelect
            label="StatTrak"
            value={filters.stattrak}
            options={[
              { value: "all", label: "ST: Any" },
              { value: "yes", label: "ST supported" },
              { value: "no", label: "No ST" },
            ]}
            onChange={(stattrak) =>
              setFilters((f) => ({
                ...f,
                stattrak: stattrak as SkinFilters["stattrak"],
              }))
            }
          />
          <button
            type="button"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                favoritesOnly: !f.favoritesOnly,
              }))
            }
            className={cn(
              "h-8 rounded-lg border px-2.5 text-xs transition-colors",
              filters.favoritesOnly
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:text-foreground",
            )}
          >
            Favorites
          </button>
        </div>
      </div>

      <SkinGrid
        skins={filtered}
        equippedSkinId={equipped?.skinId ?? null}
        favorites={favorites}
        selectedSkinId={selectedSkinId}
        loading={loading}
        onSelect={onSelectSkin}
        onEquip={onEquipSkin}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-popover">
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
