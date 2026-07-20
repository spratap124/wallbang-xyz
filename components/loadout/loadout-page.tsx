"use client";

import { useEffect, useMemo, useState } from "react";
import { Dices } from "lucide-react";

import { AgentGrid } from "@/components/loadout/agent-grid";
import { CategorySidebar } from "@/components/loadout/category-sidebar";
import { GloveGrid } from "@/components/loadout/glove-grid";
import { KnifeGrid } from "@/components/loadout/knife-grid";
import { PreviewPanel } from "@/components/loadout/preview-panel";
import { RecentlyEquipped } from "@/components/loadout/recently-equipped";
import { SearchBar } from "@/components/loadout/search-bar";
import { SkinBrowser } from "@/components/loadout/skin-browser";
import { WeaponGrid } from "@/components/loadout/weapon-grid";
import { Button } from "@/components/ui/button";
import {
  fetchCatalogIndex,
  fetchGlovesIndex,
  fetchKnivesIndex,
  loadSkinsForSlot,
} from "@/lib/loadout/api-client";
import { midFloatForWear, wearNameFromFloat } from "@/lib/loadout/constants";
import {
  resolveSkinImage,
  resolveSkinImageByName,
} from "@/lib/loadout/images";
import { AGENTS } from "@/lib/loadout/mock-data";
import { cn } from "@/lib/utils";
import type {
  AgentFaction,
  EquippedItem,
  LoadoutCategory,
  Skin,
  UserLoadoutState,
  WeaponDef,
} from "@/types/loadout";

function emptyLoadout(): UserLoadoutState {
  return {
    weapons: {},
    knife: null,
    gloves: null,
    agentCT: null,
    agentT: null,
    favorites: [],
    recentlyEquipped: [],
  };
}

function pickRandom<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

export function LoadoutPage() {
  const [loadout, setLoadout] = useState<UserLoadoutState>(emptyLoadout);
  const [weapons, setWeapons] = useState<WeaponDef[]>([]);
  const [knives, setKnives] = useState<WeaponDef[]>([]);
  const [gloves, setGloves] = useState<WeaponDef[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [category, setCategory] = useState<LoadoutCategory>("weapons");
  const [search, setSearch] = useState("");
  const [browsingSkins, setBrowsingSkins] = useState(false);
  const [activeWeaponId, setActiveWeaponId] = useState<string | null>(null);
  const [draftSkin, setDraftSkin] = useState<Skin | null>(null);
  const [wear, setWear] = useState(0.18);
  const [stattrak, setStatTrak] = useState(true);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [randomizing, setRandomizing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);

    Promise.all([
      fetchCatalogIndex(),
      fetchKnivesIndex(),
      fetchGlovesIndex(),
    ])
      .then(([weaponsIndex, knivesIndex, glovesIndex]) => {
        if (cancelled) return;
        setWeapons(weaponsIndex.weapons);
        setKnives(knivesIndex.knives);
        setGloves(glovesIndex.gloves);
        setActiveWeaponId((prev) => prev ?? weaponsIndex.weapons[0]?.id ?? null);
        setCatalogLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCatalogError(
          err instanceof Error ? err.message : "Failed to load catalog",
        );
        setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeDef = useMemo(() => {
    if (!activeWeaponId) return null;
    if (category === "knives") {
      return knives.find((k) => k.id === activeWeaponId) ?? null;
    }
    if (category === "gloves") {
      return gloves.find((g) => g.id === activeWeaponId) ?? null;
    }
    return weapons.find((w) => w.id === activeWeaponId) ?? null;
  }, [activeWeaponId, category, weapons, knives, gloves]);

  const activeDisplayName = activeDef?.name ?? activeWeaponId;

  const equippedForActive = useMemo(() => {
    if (!activeWeaponId) return null;
    if (category === "knives") {
      return loadout.knife?.weapon === activeWeaponId ? loadout.knife : null;
    }
    if (category === "gloves") {
      return loadout.gloves?.weapon === activeWeaponId ? loadout.gloves : null;
    }
    return loadout.weapons[activeWeaponId] ?? null;
  }, [activeWeaponId, category, loadout]);

  const previewItem = useMemo(() => {
    if (draftSkin && activeWeaponId) {
      const image =
        draftSkin.image ??
        resolveSkinImage({ id: activeWeaponId }, draftSkin.paintKit) ??
        (activeDisplayName
          ? resolveSkinImageByName(
              `${activeDisplayName}|${draftSkin.skinName}`,
            )
          : undefined);
      return {
        weapon: activeWeaponId,
        paintKit: draftSkin.paintKit,
        skinId: draftSkin.id,
        skinName: draftSkin.skinName,
        rarity: draftSkin.rarity,
        wear,
        wearName: wearNameFromFloat(wear),
        stattrak: draftSkin.stattrakSupported ? stattrak : false,
        seed: equippedForActive?.seed ?? 661,
        image,
        updatedAt: new Date().toISOString(),
      } satisfies EquippedItem;
    }
    return equippedForActive;
  }, [
    draftSkin,
    activeWeaponId,
    activeDisplayName,
    wear,
    stattrak,
    equippedForActive,
  ]);

  const favoriteId = draftSkin?.id ?? equippedForActive?.skinId ?? "";
  const isFavorite = favoriteId ? loadout.favorites.includes(favoriteId) : false;

  const isCurrentEquipped =
    !!draftSkin &&
    equippedForActive?.skinId === draftSkin.id &&
    Math.abs((equippedForActive?.wear ?? 0) - wear) < 0.0005 &&
    (equippedForActive?.stattrak ?? false) ===
      (draftSkin.stattrakSupported ? stattrak : false);

  function openSkinBrowser(weaponId: string, existing: EquippedItem | null) {
    setActiveWeaponId(weaponId);
    setDraftSkin(null);
    if (existing) {
      setWear(existing.wear);
      setStatTrak(existing.stattrak);
    } else {
      setWear(midFloatForWear("Field-Tested"));
      setStatTrak(false);
    }
    setBrowsingSkins(true);
    setSearch("");
    setMobilePreviewOpen(false);
  }

  function closeSkinBrowser() {
    setBrowsingSkins(false);
    setDraftSkin(null);
  }

  function handleSelectSkin(skin: Skin) {
    setDraftSkin(skin);
    if (!skin.wearSupported) setWear(0);
    if (!skin.stattrakSupported) setStatTrak(false);
    setMobilePreviewOpen(true);
  }

  function equipSkin(skin: Skin, weaponId: string) {
    const def =
      category === "knives"
        ? knives.find((k) => k.id === weaponId)
        : category === "gloves"
          ? gloves.find((g) => g.id === weaponId)
          : weapons.find((w) => w.id === weaponId);
    const displayName = def?.name ?? weaponId;
    const image =
      skin.image ??
      resolveSkinImage({ id: weaponId }, skin.paintKit) ??
      resolveSkinImageByName(`${displayName}|${skin.skinName}`);

    const item: EquippedItem = {
      weapon: weaponId,
      paintKit: skin.paintKit,
      skinId: skin.id,
      skinName: skin.skinName,
      rarity: skin.rarity,
      wear: skin.wearSupported ? wear : 0,
      wearName: wearNameFromFloat(skin.wearSupported ? wear : 0),
      stattrak: skin.stattrakSupported ? stattrak : false,
      seed: Math.floor(Math.random() * 1000),
      image,
      updatedAt: new Date().toISOString(),
    };

    setLoadout((prev) => {
      const next: UserLoadoutState = { ...prev };
      if (category === "knives") {
        next.knife = item;
      } else if (category === "gloves") {
        next.gloves = item;
      } else {
        next.weapons = { ...prev.weapons, [weaponId]: item };
      }
      next.recentlyEquipped = [
        item,
        ...prev.recentlyEquipped.filter((r) => r.skinId !== item.skinId),
      ].slice(0, 8);
      return next;
    });
    setDraftSkin(skin);
  }

  function handleEquipFromPreview() {
    if (!draftSkin || !activeWeaponId) return;
    equipSkin(draftSkin, activeWeaponId);
  }

  function toggleFavorite(skinId?: string) {
    const id = skinId || favoriteId;
    if (!id) return;
    setLoadout((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(id)
        ? prev.favorites.filter((f) => f !== id)
        : [...prev.favorites, id],
    }));
  }

  function equipAgent(agentId: string, name: string, faction: AgentFaction) {
    const agent = { agentId, name, faction, updatedAt: new Date().toISOString() };
    setLoadout((prev) => ({
      ...prev,
      agentCT: faction === "CT" ? agent : prev.agentCT,
      agentT: faction === "T" ? agent : prev.agentT,
    }));
  }

  async function randomizeLoadout() {
    const randomWeapon = pickRandom(weapons);
    const randomKnife = pickRandom(knives);
    const randomGlove = pickRandom(gloves);
    if (!randomWeapon || !randomKnife || !randomGlove) return;

    setRandomizing(true);
    try {
      const [weaponSkins, knifeSkins, gloveSkins] = await Promise.all([
        loadSkinsForSlot("weapons", randomWeapon.id),
        loadSkinsForSlot("knives", randomKnife.id),
        loadSkinsForSlot("gloves", randomGlove.id),
      ]);

      const weaponSkin = pickRandom(weaponSkins);
      const knifeSkin = pickRandom(knifeSkins);
      const gloveSkin = pickRandom(gloveSkins);
      if (!weaponSkin || !knifeSkin || !gloveSkin) return;

      const ct = pickRandom(AGENTS.filter((a) => a.faction === "CT"));
      const t = pickRandom(AGENTS.filter((a) => a.faction === "T"));
      if (!ct || !t) return;

      const make = (skin: Skin, weaponId: string, displayName: string): EquippedItem => {
        const itemWear = skin.wearSupported ? Math.random() * 0.5 : 0;
        return {
          weapon: weaponId,
          paintKit: skin.paintKit,
          skinId: skin.id,
          skinName: skin.skinName,
          rarity: skin.rarity,
          wear: itemWear,
          wearName: wearNameFromFloat(itemWear),
          stattrak: skin.stattrakSupported ? Math.random() > 0.5 : false,
          seed: Math.floor(Math.random() * 1000),
          image:
            skin.image ??
            resolveSkinImage({ id: weaponId }, skin.paintKit) ??
            resolveSkinImageByName(`${displayName}|${skin.skinName}`),
          updatedAt: new Date().toISOString(),
        };
      };

      const weaponItem = make(weaponSkin, randomWeapon.id, randomWeapon.name);
      const knifeItem = make(knifeSkin, randomKnife.id, randomKnife.name);
      const gloveItem = make(gloveSkin, randomGlove.id, randomGlove.name);

      setLoadout((prev) => ({
        ...prev,
        weapons: { ...prev.weapons, [randomWeapon.id]: weaponItem },
        knife: knifeItem,
        gloves: gloveItem,
        agentCT: {
          agentId: ct.id,
          name: ct.name,
          faction: "CT",
          updatedAt: new Date().toISOString(),
        },
        agentT: {
          agentId: t.id,
          name: t.name,
          faction: "T",
          updatedAt: new Date().toISOString(),
        },
        recentlyEquipped: [
          weaponItem,
          gloveItem,
          knifeItem,
          ...prev.recentlyEquipped,
        ].slice(0, 8),
      }));
      setCategory("weapons");
      setActiveWeaponId(randomWeapon.id);
      setDraftSkin(weaponSkin);
      setWear(weaponItem.wear);
      setStatTrak(weaponItem.stattrak);
    } finally {
      setRandomizing(false);
    }
  }

  function handleRecentSelect(item: EquippedItem) {
    const isKnife = knives.some((k) => k.id === item.weapon);
    const isGlove = gloves.some((g) => g.id === item.weapon);
    setCategory(isKnife ? "knives" : isGlove ? "gloves" : "weapons");
    openSkinBrowser(item.weapon, item);
  }

  const skinCategory =
    category === "knives" || category === "gloves" ? category : "weapons";

  function resolveWeaponLabel(weaponId: string): string {
    return (
      weapons.find((w) => w.id === weaponId)?.name ??
      knives.find((k) => k.id === weaponId)?.name ??
      gloves.find((g) => g.id === weaponId)?.name ??
      weaponId
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Loadout
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Your Personal CS2 Inventory
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Equip skins, knives, gloves, and agents. Changes sync to WallBang
            servers when you join.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void randomizeLoadout()}
          disabled={catalogLoading || randomizing || weapons.length === 0}
          className="shrink-0"
        >
          <Dices data-icon="inline-start" />
          {randomizing ? "Randomizing…" : "Random Loadout"}
        </Button>
      </header>

      {!browsingSkins ? (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search weapons, skins, rarity..."
            className="sm:max-w-md sm:flex-1"
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] xl:grid-cols-[11rem_minmax(0,1fr)_20rem]">
        <CategorySidebar
          active={category}
          onChange={(next) => {
            setCategory(next);
            setDraftSkin(null);
            setSearch("");
            setBrowsingSkins(false);
            if (next === "knives") {
              setActiveWeaponId(loadout.knife?.weapon ?? knives[0]?.id ?? null);
            } else if (next === "gloves") {
              setActiveWeaponId(
                loadout.gloves?.weapon ?? gloves[0]?.id ?? null,
              );
            } else if (next === "weapons") {
              setActiveWeaponId(weapons[0]?.id ?? null);
            } else {
              setActiveWeaponId(null);
            }
          }}
          className="lg:sticky lg:top-20 lg:self-start"
        />

        <div className="min-w-0">
          {browsingSkins &&
          activeWeaponId &&
          activeDisplayName &&
          category !== "agents" ? (
            <SkinBrowser
              weaponId={activeWeaponId}
              weaponDisplayName={activeDisplayName}
              category={skinCategory}
              equipped={equippedForActive}
              favorites={loadout.favorites}
              selectedSkinId={draftSkin?.id ?? null}
              onBack={closeSkinBrowser}
              onSelectSkin={handleSelectSkin}
              onEquipSkin={(skin) => {
                equipSkin(skin, activeWeaponId);
              }}
              onToggleFavorite={(id) => toggleFavorite(id)}
            />
          ) : (
            <>
              {category !== "agents" ? (
                <RecentlyEquipped
                  items={loadout.recentlyEquipped}
                  onSelect={handleRecentSelect}
                  resolveWeaponLabel={resolveWeaponLabel}
                />
              ) : null}

              {category === "weapons" ? (
                <WeaponGrid
                  weapons={weapons}
                  equipped={loadout.weapons}
                  weaponFilter={search}
                  selectedWeapon={activeWeaponId}
                  loading={catalogLoading}
                  error={catalogError}
                  onSelectWeapon={(id) =>
                    openSkinBrowser(id, loadout.weapons[id] ?? null)
                  }
                  onPreview={(item, id) => {
                    setActiveWeaponId(id);
                    setDraftSkin(null);
                    if (item) {
                      setWear(item.wear);
                      setStatTrak(item.stattrak);
                    }
                  }}
                />
              ) : null}

              {category === "knives" ? (
                <KnifeGrid
                  knives={knives}
                  equippedKnife={loadout.knife}
                  filter={search}
                  selectedKnife={activeWeaponId}
                  loading={catalogLoading}
                  error={catalogError}
                  onSelectKnife={(id) =>
                    openSkinBrowser(
                      id,
                      loadout.knife?.weapon === id ? loadout.knife : null,
                    )
                  }
                  onPreview={(item, id) => {
                    setActiveWeaponId(id);
                    setDraftSkin(null);
                    if (item) {
                      setWear(item.wear);
                      setStatTrak(item.stattrak);
                    }
                  }}
                />
              ) : null}

              {category === "gloves" ? (
                <GloveGrid
                  gloves={gloves}
                  equippedGloves={loadout.gloves}
                  filter={search}
                  selectedGloves={activeWeaponId}
                  loading={catalogLoading}
                  error={catalogError}
                  onSelectGloves={(id) =>
                    openSkinBrowser(
                      id,
                      loadout.gloves?.weapon === id ? loadout.gloves : null,
                    )
                  }
                  onPreview={(item, id) => {
                    setActiveWeaponId(id);
                    setDraftSkin(null);
                    if (item) {
                      setWear(item.wear);
                      setStatTrak(item.stattrak);
                    }
                  }}
                />
              ) : null}

              {category === "agents" ? (
                <AgentGrid
                  agentCT={loadout.agentCT}
                  agentT={loadout.agentT}
                  filter={search}
                  onEquip={equipAgent}
                />
              ) : null}
            </>
          )}
        </div>

        {category !== "agents" ? (
          <PreviewPanel
            weaponName={activeDisplayName}
            weaponId={activeWeaponId}
            weaponDefIndex={activeDef?.defIndex}
            preview={previewItem}
            draftSkin={draftSkin}
            wear={wear}
            stattrak={stattrak}
            isFavorite={isFavorite}
            canEquip={!!draftSkin}
            isEquipped={isCurrentEquipped}
            onWearChange={setWear}
            onStatTrakChange={setStatTrak}
            onEquip={handleEquipFromPreview}
            onToggleFavorite={() => toggleFavorite()}
            className="hidden xl:sticky xl:top-20 xl:flex xl:self-start"
          />
        ) : null}
      </div>

      {/* Mobile preview — only while browsing skins */}
      {browsingSkins &&
      category !== "agents" &&
      mobilePreviewOpen &&
      activeDisplayName ? (
        <div className="fixed inset-x-0 bottom-0 z-40 xl:hidden">
          <button
            type="button"
            className="absolute inset-0 -top-[100vh] bg-black/40"
            aria-label="Close preview"
            onClick={() => setMobilePreviewOpen(false)}
          />
          <div className="relative max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-border bg-popover p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <PreviewPanel
              weaponName={activeDisplayName}
              weaponId={activeWeaponId}
              weaponDefIndex={activeDef?.defIndex}
              preview={previewItem}
              draftSkin={draftSkin}
              wear={wear}
              stattrak={stattrak}
              isFavorite={isFavorite}
              canEquip={!!draftSkin}
              isEquipped={isCurrentEquipped}
              onWearChange={setWear}
              onStatTrakChange={setStatTrak}
              onEquip={() => {
                handleEquipFromPreview();
                setMobilePreviewOpen(false);
              }}
              onToggleFavorite={() => toggleFavorite()}
              className={cn("ring-0")}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
