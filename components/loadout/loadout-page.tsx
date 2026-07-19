"use client";

import { useMemo, useState } from "react";
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
import { midFloatForWear, wearNameFromFloat } from "@/lib/loadout/constants";
import {
  AGENTS,
  GLOVES,
  KNIVES,
  WEAPONS,
  createInitialLoadout,
  getSkinsForWeapon,
} from "@/lib/loadout/mock-data";
import { cn } from "@/lib/utils";
import type {
  AgentFaction,
  EquippedItem,
  LoadoutCategory,
  Skin,
  UserLoadoutState,
} from "@/types/loadout";

export function LoadoutPage() {
  const [loadout, setLoadout] = useState<UserLoadoutState>(createInitialLoadout);
  const [category, setCategory] = useState<LoadoutCategory>("weapons");
  const [search, setSearch] = useState("");
  const [browsingSkins, setBrowsingSkins] = useState(false);
  const [activeWeapon, setActiveWeapon] = useState<string | null>("AK-47");
  const [draftSkin, setDraftSkin] = useState<Skin | null>(null);
  const [wear, setWear] = useState(0.18);
  const [stattrak, setStatTrak] = useState(true);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const equippedForActive = useMemo(() => {
    if (!activeWeapon) return null;
    if (category === "knives") {
      return loadout.knife?.weapon === activeWeapon ? loadout.knife : null;
    }
    if (category === "gloves") {
      return loadout.gloves?.weapon === activeWeapon ? loadout.gloves : null;
    }
    return loadout.weapons[activeWeapon] ?? null;
  }, [activeWeapon, category, loadout]);

  const previewItem = useMemo(() => {
    if (draftSkin && activeWeapon) {
      return {
        weapon: activeWeapon,
        paintKit: draftSkin.paintKit,
        skinId: draftSkin.id,
        skinName: draftSkin.skinName,
        rarity: draftSkin.rarity,
        wear,
        wearName: wearNameFromFloat(wear),
        stattrak: draftSkin.stattrakSupported ? stattrak : false,
        seed: equippedForActive?.seed ?? 661,
        image: draftSkin.image,
        updatedAt: new Date().toISOString(),
      } satisfies EquippedItem;
    }
    return equippedForActive;
  }, [draftSkin, activeWeapon, wear, stattrak, equippedForActive]);

  const favoriteId = draftSkin?.id ?? equippedForActive?.skinId ?? "";
  const isFavorite = favoriteId ? loadout.favorites.includes(favoriteId) : false;

  const isCurrentEquipped =
    !!draftSkin &&
    equippedForActive?.skinId === draftSkin.id &&
    Math.abs((equippedForActive?.wear ?? 0) - wear) < 0.0005 &&
    (equippedForActive?.stattrak ?? false) ===
      (draftSkin.stattrakSupported ? stattrak : false);

  function openSkinBrowser(weaponName: string, existing: EquippedItem | null) {
    setActiveWeapon(weaponName);
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

  function equipSkin(skin: Skin, weaponName: string) {
    const item: EquippedItem = {
      weapon: weaponName,
      paintKit: skin.paintKit,
      skinId: skin.id,
      skinName: skin.skinName,
      rarity: skin.rarity,
      wear: skin.wearSupported ? wear : 0,
      wearName: wearNameFromFloat(skin.wearSupported ? wear : 0),
      stattrak: skin.stattrakSupported ? stattrak : false,
      seed: Math.floor(Math.random() * 1000),
      image: skin.image,
      updatedAt: new Date().toISOString(),
    };

    setLoadout((prev) => {
      const next: UserLoadoutState = { ...prev };
      if (category === "knives") {
        next.knife = item;
      } else if (category === "gloves") {
        next.gloves = item;
      } else {
        next.weapons = { ...prev.weapons, [weaponName]: item };
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
    if (!draftSkin || !activeWeapon) return;
    equipSkin(draftSkin, activeWeapon);
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

  function randomizeLoadout() {
    const randomWeapon = WEAPONS[Math.floor(Math.random() * WEAPONS.length)]!;
    const weaponSkins = getSkinsForWeapon(randomWeapon.name);
    const weaponSkin = weaponSkins[Math.floor(Math.random() * weaponSkins.length)]!;

    const randomKnife = KNIVES[Math.floor(Math.random() * KNIVES.length)]!;
    const knifeSkins = getSkinsForWeapon(randomKnife.name);
    const knifeSkin = knifeSkins[Math.floor(Math.random() * knifeSkins.length)]!;

    const randomGlove = GLOVES[Math.floor(Math.random() * GLOVES.length)]!;
    const gloveSkins = getSkinsForWeapon(randomGlove.name);
    const gloveSkin = gloveSkins[Math.floor(Math.random() * gloveSkins.length)]!;

    const ctAgents = AGENTS.filter((a) => a.faction === "CT");
    const tAgents = AGENTS.filter((a) => a.faction === "T");
    const ct = ctAgents[Math.floor(Math.random() * ctAgents.length)]!;
    const t = tAgents[Math.floor(Math.random() * tAgents.length)]!;

    const make = (skin: Skin, weapon: string): EquippedItem => {
      const itemWear = skin.wearSupported ? Math.random() * 0.5 : 0;
      return {
        weapon,
        paintKit: skin.paintKit,
        skinId: skin.id,
        skinName: skin.skinName,
        rarity: skin.rarity,
        wear: itemWear,
        wearName: wearNameFromFloat(itemWear),
        stattrak: skin.stattrakSupported ? Math.random() > 0.5 : false,
        seed: Math.floor(Math.random() * 1000),
        image: skin.image,
        updatedAt: new Date().toISOString(),
      };
    };

    const weaponItem = make(weaponSkin, randomWeapon.name);
    const knifeItem = make(knifeSkin, randomKnife.name);
    const gloveItem = make(gloveSkin, randomGlove.name);

    setLoadout((prev) => ({
      ...prev,
      weapons: { ...prev.weapons, [randomWeapon.name]: weaponItem },
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
      recentlyEquipped: [weaponItem, gloveItem, knifeItem, ...prev.recentlyEquipped].slice(
        0,
        8,
      ),
    }));
    setCategory("weapons");
    setActiveWeapon(randomWeapon.name);
    setDraftSkin(weaponSkin);
    setWear(weaponItem.wear);
    setStatTrak(weaponItem.stattrak);
  }

  function handleRecentSelect(item: EquippedItem) {
    const isKnife = KNIVES.some((k) => k.name === item.weapon);
    const isGlove = GLOVES.some((g) => g.name === item.weapon);
    setCategory(isKnife ? "knives" : isGlove ? "gloves" : "weapons");
    openSkinBrowser(item.weapon, item);
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
        <Button variant="outline" onClick={randomizeLoadout} className="shrink-0">
          <Dices data-icon="inline-start" />
          Random Loadout
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
            if (next === "knives") setActiveWeapon(loadout.knife?.weapon ?? "Karambit");
            else if (next === "gloves")
              setActiveWeapon(loadout.gloves?.weapon ?? "Sport Gloves");
            else if (next === "weapons") setActiveWeapon("AK-47");
            else setActiveWeapon(null);
          }}
          className="lg:sticky lg:top-20 lg:self-start"
        />

        <div className="min-w-0">
          {browsingSkins && activeWeapon && category !== "agents" ? (
            <SkinBrowser
              weaponName={activeWeapon}
              equipped={equippedForActive}
              favorites={loadout.favorites}
              selectedSkinId={draftSkin?.id ?? null}
              onBack={closeSkinBrowser}
              onSelectSkin={handleSelectSkin}
              onEquipSkin={(skin) => {
                equipSkin(skin, activeWeapon);
              }}
              onToggleFavorite={(id) => toggleFavorite(id)}
            />
          ) : (
            <>
              {category !== "agents" ? (
                <RecentlyEquipped
                  items={loadout.recentlyEquipped}
                  onSelect={handleRecentSelect}
                />
              ) : null}

              {category === "weapons" ? (
                <WeaponGrid
                  equipped={loadout.weapons}
                  weaponFilter={search}
                  selectedWeapon={activeWeapon}
                  onSelectWeapon={(name) =>
                    openSkinBrowser(name, loadout.weapons[name] ?? null)
                  }
                  onPreview={(item, name) => {
                    setActiveWeapon(name);
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
                  equippedKnife={loadout.knife}
                  filter={search}
                  selectedKnife={activeWeapon}
                  onSelectKnife={(name) =>
                    openSkinBrowser(
                      name,
                      loadout.knife?.weapon === name ? loadout.knife : null,
                    )
                  }
                  onPreview={(item, name) => {
                    setActiveWeapon(name);
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
                  equippedGloves={loadout.gloves}
                  filter={search}
                  selectedGloves={activeWeapon}
                  onSelectGloves={(name) =>
                    openSkinBrowser(
                      name,
                      loadout.gloves?.weapon === name ? loadout.gloves : null,
                    )
                  }
                  onPreview={(item, name) => {
                    setActiveWeapon(name);
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
            weaponName={activeWeapon}
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
      activeWeapon ? (
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
              weaponName={activeWeapon}
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
