"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Shuffle } from "lucide-react";

import { AgentGrid } from "@/components/loadout/agent-grid";
import { GloveGrid } from "@/components/loadout/glove-grid";
import { KnifeGrid } from "@/components/loadout/knife-grid";
import { LoadoutTabs } from "@/components/loadout/loadout-tabs";
import { OverviewGrid } from "@/components/loadout/overview-grid";
import { PreviewPanel } from "@/components/loadout/preview-panel";
import { SearchBar } from "@/components/loadout/search-bar";
import { SideSwitcher } from "@/components/loadout/side-switcher";
import { SkinBrowser } from "@/components/loadout/skin-browser";
import { WeaponGrid } from "@/components/loadout/weapon-grid";
import { Button } from "@/components/ui/button";
import {
  fetchCatalogIndex,
  fetchGlovesIndex,
  fetchKnivesIndex,
  fetchSavedLoadout,
  loadSkinsForSlot,
  saveSavedLoadout,
} from "@/lib/loadout/api-client";
import {
  midFloatForWear,
  TAB_WEAPON_GROUP,
  WEAPON_GROUP_TAB,
  wearNameFromFloat,
} from "@/lib/loadout/constants";
import {
  resolveSkinImage,
  resolveSkinImageByName,
} from "@/lib/loadout/images";
import { AGENTS } from "@/lib/loadout/mock-data";
import { weaponsForSide, withCanonicalGroups } from "@/lib/loadout/weapon-sides";
import {
  emptyUserLoadout,
  getSideLoadout,
  sanitizeUserLoadout,
  updateSideLoadout,
} from "@/types/player-loadout";
import { cn } from "@/lib/utils";
import type {
  AgentFaction,
  EquippedItem,
  LoadoutSide,
  LoadoutTab,
  SideLoadout,
  Skin,
  UserLoadoutState,
  WeaponDef,
} from "@/types/loadout";

const LOADOUT_UI_KEY = "wallbang.loadout.ui";
const LOADOUT_TABS: LoadoutTab[] = [
  "overview",
  "pistols",
  "smgs",
  "rifles",
  "heavy",
  "snipers",
  "knives",
  "gloves",
  "agents",
];

type LoadoutUiPrefs = {
  side: LoadoutSide;
  tab: LoadoutTab;
  activeWeaponId: string | null;
};

function isLoadoutTab(value: unknown): value is LoadoutTab {
  return (
    typeof value === "string" && LOADOUT_TABS.includes(value as LoadoutTab)
  );
}

function readLoadoutUi(): LoadoutUiPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOADOUT_UI_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LoadoutUiPrefs>;
    const side = parsed.side === "T" ? "T" : parsed.side === "CT" ? "CT" : null;
    if (!side || !isLoadoutTab(parsed.tab)) return null;
    return {
      side,
      tab: parsed.tab,
      activeWeaponId:
        typeof parsed.activeWeaponId === "string" ? parsed.activeWeaponId : null,
    };
  } catch {
    return null;
  }
}

function writeLoadoutUi(prefs: LoadoutUiPrefs) {
  try {
    window.localStorage.setItem(LOADOUT_UI_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

function pickSlotWeaponId(
  nextTab: LoadoutTab,
  list: WeaponDef[],
  sideState: SideLoadout,
  knives: WeaponDef[],
  gloves: WeaponDef[],
): string | null {
  if (nextTab === "knives") {
    return sideState.knife?.weapon ?? knives[0]?.id ?? null;
  }
  if (nextTab === "gloves") {
    return sideState.gloves?.weapon ?? gloves[0]?.id ?? null;
  }
  if (nextTab === "agents") return null;
  if (nextTab === "overview") {
    return (
      list.find((w) => sideState.weapons[w.id])?.id ??
      sideState.knife?.weapon ??
      sideState.gloves?.weapon ??
      list[0]?.id ??
      null
    );
  }
  const group = TAB_WEAPON_GROUP[nextTab];
  const inGroup = group ? list.filter((w) => w.group === group) : list;
  return (
    inGroup.find((w) => sideState.weapons[w.id])?.id ?? inGroup[0]?.id ?? null
  );
}

function weaponBelongsToTab(
  id: string,
  tab: LoadoutTab,
  weapons: WeaponDef[],
  knives: WeaponDef[],
  gloves: WeaponDef[],
): boolean {
  if (tab === "agents") return false;
  if (tab === "knives") return knives.some((k) => k.id === id);
  if (tab === "gloves") return gloves.some((g) => g.id === id);
  if (tab === "overview") {
    return (
      weapons.some((w) => w.id === id) ||
      knives.some((k) => k.id === id) ||
      gloves.some((g) => g.id === id)
    );
  }
  const group = TAB_WEAPON_GROUP[tab];
  return weapons.some((w) => w.id === id && (!group || w.group === group));
}

function pickRandom<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function slotKind(
  tab: LoadoutTab,
): "weapons" | "knives" | "gloves" | "agents" | "overview" {
  if (tab === "knives") return "knives";
  if (tab === "gloves") return "gloves";
  if (tab === "agents") return "agents";
  if (tab === "overview") return "overview";
  return "weapons";
}

export function LoadoutPage() {
  const [loadout, setLoadout] = useState<UserLoadoutState>(emptyUserLoadout);
  const [weapons, setWeapons] = useState<WeaponDef[]>([]);
  const [knives, setKnives] = useState<WeaponDef[]>([]);
  const [gloves, setGloves] = useState<WeaponDef[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [side, setSide] = useState<LoadoutSide>("CT");
  const [tab, setTab] = useState<LoadoutTab>("pistols");
  const [search, setSearch] = useState("");
  const [browsingSkins, setBrowsingSkins] = useState(false);
  const [activeWeaponId, setActiveWeaponId] = useState<string | null>(null);
  const [draftSkin, setDraftSkin] = useState<Skin | null>(null);
  const [wear, setWear] = useState(0.18);
  const [seed, setSeed] = useState(661);
  const [stattrak, setStatTrak] = useState(true);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [randomizing, setRandomizing] = useState(false);
  const readyToSaveRef = useRef(false);

  const sideLoadout = getSideLoadout(loadout, side);
  const kind = slotKind(tab);
  const visibleWeapons = useMemo(
    () => weaponsForSide(weapons, side),
    [weapons, side],
  );

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);

    Promise.all([
      fetchCatalogIndex(),
      fetchKnivesIndex(),
      fetchGlovesIndex(),
      fetchSavedLoadout().catch(() => null),
    ])
      .then(([weaponsIndex, knivesIndex, glovesIndex, saved]) => {
        if (cancelled) return;
        const catalogWeapons = withCanonicalGroups(weaponsIndex.weapons);
        const nextKnives = knivesIndex.knives;
        const nextGloves = glovesIndex.gloves;
        const nextLoadout = saved?.loadout
          ? sanitizeUserLoadout(saved.loadout)
          : emptyUserLoadout();
        const prefs = readLoadoutUi();
        const nextSide = prefs?.side ?? "CT";
        const nextTab = prefs?.tab ?? "pistols";
        const visible = weaponsForSide(catalogWeapons, nextSide);
        const sideState = getSideLoadout(nextLoadout, nextSide);
        const restoredId =
          prefs?.activeWeaponId &&
          weaponBelongsToTab(
            prefs.activeWeaponId,
            nextTab,
            visible,
            nextKnives,
            nextGloves,
          )
            ? prefs.activeWeaponId
            : pickSlotWeaponId(
                nextTab,
                visible,
                sideState,
                nextKnives,
                nextGloves,
              );
        const existing =
          restoredId == null
            ? null
            : sideState.knife?.weapon === restoredId
              ? sideState.knife
              : sideState.gloves?.weapon === restoredId
                ? sideState.gloves
                : (sideState.weapons[restoredId] ?? null);

        setWeapons(catalogWeapons);
        setKnives(nextKnives);
        setGloves(nextGloves);
        setLoadout(nextLoadout);
        setSide(nextSide);
        setTab(nextTab);
        setActiveWeaponId(restoredId);
        if (existing) {
          setWear(existing.wear);
          setStatTrak(existing.stattrak);
          setSeed(existing.seed);
        }
        readyToSaveRef.current = true;
        setCatalogLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        readyToSaveRef.current = true;
        setCatalogError(
          err instanceof Error ? err.message : "Failed to load catalog",
        );
        setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!readyToSaveRef.current) return;
    writeLoadoutUi({ side, tab, activeWeaponId });
  }, [side, tab, activeWeaponId]);

  function persistLoadout(next: UserLoadoutState) {
    if (!readyToSaveRef.current) return;
    setSaving(true);
    setSyncError(null);
    void saveSavedLoadout(next)
      .then(() => setSaving(false))
      .catch((err: unknown) => {
        setSaving(false);
        setSyncError(
          err instanceof Error ? err.message : "Failed to save loadout",
        );
      });
  }

  function updateLoadout(
    updater: (prev: UserLoadoutState) => UserLoadoutState,
  ) {
    setLoadout((prev) => {
      const next = updater(prev);
      persistLoadout(next);
      return next;
    });
  }

  const activeDef = useMemo(() => {
    if (!activeWeaponId) return null;
    if (kind === "knives" || (kind === "overview" && sideLoadout.knife?.weapon === activeWeaponId)) {
      return knives.find((k) => k.id === activeWeaponId) ?? null;
    }
    if (kind === "gloves" || (kind === "overview" && sideLoadout.gloves?.weapon === activeWeaponId)) {
      return gloves.find((g) => g.id === activeWeaponId) ?? null;
    }
    return weapons.find((w) => w.id === activeWeaponId) ?? null;
  }, [activeWeaponId, kind, weapons, knives, gloves, sideLoadout.knife, sideLoadout.gloves]);

  const activeDisplayName = activeDef?.name ?? activeWeaponId;

  const equippedForActive = useMemo(() => {
    if (!activeWeaponId) return null;
    if (sideLoadout.knife?.weapon === activeWeaponId) return sideLoadout.knife;
    if (sideLoadout.gloves?.weapon === activeWeaponId) return sideLoadout.gloves;
    return sideLoadout.weapons[activeWeaponId] ?? null;
  }, [activeWeaponId, sideLoadout]);

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
        seed,
        image,
        updatedAt: new Date().toISOString(),
      } satisfies EquippedItem;
    }
    return equippedForActive
      ? { ...equippedForActive, wear, wearName: wearNameFromFloat(wear), stattrak, seed }
      : null;
  }, [
    draftSkin,
    activeWeaponId,
    activeDisplayName,
    wear,
    stattrak,
    seed,
    equippedForActive,
  ]);

  const favoriteId = draftSkin?.id ?? equippedForActive?.skinId ?? "";
  const isFavorite = favoriteId ? loadout.favorites.includes(favoriteId) : false;

  const equippedMatchesPreview =
    !!equippedForActive &&
    Math.abs(equippedForActive.wear - wear) < 0.0005 &&
    equippedForActive.seed === seed &&
    equippedForActive.stattrak ===
      (draftSkin ? (draftSkin.stattrakSupported ? stattrak : false) : stattrak) &&
    (draftSkin ? equippedForActive.skinId === draftSkin.id : true);

  const canEquip = !!draftSkin || !!equippedForActive;
  const isCurrentEquipped = equippedMatchesPreview && (!!draftSkin || !!equippedForActive);

  function applyEquippedToEditors(existing: EquippedItem | null) {
    if (existing) {
      setWear(existing.wear);
      setStatTrak(existing.stattrak);
      setSeed(existing.seed);
    } else {
      setWear(midFloatForWear("Field-Tested"));
      setStatTrak(false);
      setSeed(Math.floor(Math.random() * 1000));
    }
  }

  function openSkinBrowser(weaponId: string, existing: EquippedItem | null) {
    setActiveWeaponId(weaponId);
    setDraftSkin(null);
    applyEquippedToEditors(existing);
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

  function currentSlotKind(): "weapons" | "knives" | "gloves" {
    if (kind === "knives") return "knives";
    if (kind === "gloves") return "gloves";
    if (sideLoadout.knife?.weapon === activeWeaponId) return "knives";
    if (sideLoadout.gloves?.weapon === activeWeaponId) return "gloves";
    return "weapons";
  }

  function equipSkin(skin: Skin, weaponId: string) {
    const slot = currentSlotKind();
    const def =
      slot === "knives"
        ? knives.find((k) => k.id === weaponId)
        : slot === "gloves"
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
      seed,
      image,
      updatedAt: new Date().toISOString(),
    };

    writeEquippedItem(item, slot);
    setDraftSkin(skin);
  }

  function writeEquippedItem(
    item: EquippedItem,
    slot: "weapons" | "knives" | "gloves",
  ) {
    updateLoadout((prev) => {
      const next = updateSideLoadout(prev, side, (current) => {
        if (slot === "knives") return { ...current, knife: item };
        if (slot === "gloves") return { ...current, gloves: item };
        return {
          ...current,
          weapons: { ...current.weapons, [item.weapon]: item },
        };
      });
      return {
        ...next,
        recentlyEquipped: [
          item,
          ...prev.recentlyEquipped.filter((r) => r.skinId !== item.skinId),
        ].slice(0, 8),
      };
    });
  }

  function handleEquipFromPreview() {
    if (!activeWeaponId) return;
    if (draftSkin) {
      equipSkin(draftSkin, activeWeaponId);
      return;
    }
    if (!equippedForActive) return;
    writeEquippedItem(
      {
        ...equippedForActive,
        wear,
        wearName: wearNameFromFloat(wear),
        stattrak,
        seed,
        updatedAt: new Date().toISOString(),
      },
      currentSlotKind(),
    );
  }

  function toggleFavorite(skinId?: string) {
    const id = skinId || favoriteId;
    if (!id) return;
    updateLoadout((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(id)
        ? prev.favorites.filter((f) => f !== id)
        : [...prev.favorites, id],
    }));
  }

  function equipAgent(agentId: string, name: string, faction: AgentFaction) {
    const agent = { agentId, name, faction, updatedAt: new Date().toISOString() };
    updateLoadout((prev) =>
      updateSideLoadout(prev, faction, (current) => ({ ...current, agent })),
    );
  }

  function handleWeaponClick(
    id: string,
    existing: EquippedItem | null,
    nextTab?: LoadoutTab,
  ) {
    if (nextTab) setTab(nextTab);
    if (activeWeaponId === id && !browsingSkins) {
      openSkinBrowser(id, existing);
      return;
    }
    setActiveWeaponId(id);
    setDraftSkin(null);
    applyEquippedToEditors(existing);
  }

  function changeSide(next: LoadoutSide) {
    setSide(next);
    setDraftSkin(null);
    setBrowsingSkins(false);
    const nextSide = getSideLoadout(loadout, next);
    const visible = weaponsForSide(weapons, next);

    if (tab === "knives" || tab === "gloves" || tab === "agents") {
      const existing =
        (activeWeaponId && nextSide.weapons[activeWeaponId]) ||
        (nextSide.knife?.weapon === activeWeaponId ? nextSide.knife : null) ||
        (nextSide.gloves?.weapon === activeWeaponId ? nextSide.gloves : null);
      applyEquippedToEditors(existing ?? null);
      return;
    }

    const stillValid =
      !!activeWeaponId && visible.some((w) => w.id === activeWeaponId);
    const nextWeaponId = stillValid
      ? activeWeaponId
      : pickSlotWeaponId(tab, visible, nextSide, knives, gloves);

    setActiveWeaponId(nextWeaponId);
    const existing =
      nextWeaponId == null
        ? null
        : nextSide.knife?.weapon === nextWeaponId
          ? nextSide.knife
          : nextSide.gloves?.weapon === nextWeaponId
            ? nextSide.gloves
            : (nextSide.weapons[nextWeaponId] ?? null);
    applyEquippedToEditors(existing);
  }

  function changeTab(next: LoadoutTab) {
    setTab(next);
    setDraftSkin(null);
    setSearch("");
    setBrowsingSkins(false);
    const nextId = pickSlotWeaponId(
      next,
      visibleWeapons,
      sideLoadout,
      knives,
      gloves,
    );
    setActiveWeaponId(nextId);
    if (next === "agents") {
      applyEquippedToEditors(null);
      return;
    }
    const existing =
      nextId == null
        ? null
        : sideLoadout.knife?.weapon === nextId
          ? sideLoadout.knife
          : sideLoadout.gloves?.weapon === nextId
            ? sideLoadout.gloves
            : (sideLoadout.weapons[nextId] ?? null);
    applyEquippedToEditors(existing);
  }

  async function randomizeLoadout() {
    const randomWeapon = pickRandom(visibleWeapons);
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

      const agentPool = AGENTS.filter((a) => a.faction === side);
      const agent = pickRandom(agentPool);
      if (!agent) return;

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

      updateLoadout((prev) => {
        const next = updateSideLoadout(prev, side, (current) => ({
          ...current,
          weapons: { ...current.weapons, [randomWeapon.id]: weaponItem },
          knife: knifeItem,
          gloves: gloveItem,
          agent: {
            agentId: agent.id,
            name: agent.name,
            faction: side,
            updatedAt: new Date().toISOString(),
          },
        }));
        return {
          ...next,
          recentlyEquipped: [
            weaponItem,
            gloveItem,
            knifeItem,
            ...prev.recentlyEquipped,
          ].slice(0, 8),
        };
      });
      setTab("pistols");
      setActiveWeaponId(randomWeapon.id);
      setDraftSkin(weaponSkin);
      setWear(weaponItem.wear);
      setSeed(weaponItem.seed);
      setStatTrak(weaponItem.stattrak);
    } finally {
      setRandomizing(false);
    }
  }

  const skinCategory =
    currentSlotKind() === "knives" || currentSlotKind() === "gloves"
      ? currentSlotKind()
      : "weapons";

  const weaponGroup = TAB_WEAPON_GROUP[tab] ?? activeDef?.group;

  const randomButton = (
    <Button
      variant="outline"
      onClick={() => void randomizeLoadout()}
      disabled={catalogLoading || randomizing || visibleWeapons.length === 0}
      className="shrink-0"
    >
      <Shuffle data-icon="inline-start" />
      {randomizing ? "Randomizing…" : "Random Loadout"}
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-[90rem] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="mb-6">
        <p className="mb-2 text-xs font-medium tracking-[0.2em] text-primary uppercase">
          Loadout
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your Wallbang Inventory
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Equip a separate loadout for CT and T. Saved loadouts sync to WallBang
          servers when you join a match
          {saving ? " · Saving…" : syncError ? ` · ${syncError}` : ""}.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-5">
          <SideSwitcher side={side} onChange={changeSide} />
          <LoadoutTabs active={tab} onChange={changeTab} />

          {!browsingSkins ? (
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search weapons, skins, rarity..."
              className="sm:max-w-md"
            />
          ) : null}

          {browsingSkins &&
          activeWeaponId &&
          activeDisplayName &&
          tab !== "agents" ? (
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
              {tab === "overview" ? (
                <OverviewGrid
                  weapons={visibleWeapons}
                  knives={knives}
                  gloves={gloves}
                  equippedWeapons={sideLoadout.weapons}
                  equippedKnife={sideLoadout.knife}
                  equippedGloves={sideLoadout.gloves}
                  selectedWeapon={activeWeaponId}
                  favorites={loadout.favorites}
                  onToggleFavorite={toggleFavorite}
                  onSelectWeapon={(id, nextKind) => {
                    const existing =
                      nextKind === "knives"
                        ? sideLoadout.knife
                        : nextKind === "gloves"
                          ? sideLoadout.gloves
                          : (sideLoadout.weapons[id] ?? null);
                    const group = weapons.find((w) => w.id === id)?.group;
                    const nextTab: LoadoutTab =
                      nextKind === "knives"
                        ? "knives"
                        : nextKind === "gloves"
                          ? "gloves"
                          : (group ? (WEAPON_GROUP_TAB[group] ?? "pistols") : "pistols");
                    handleWeaponClick(id, existing, nextTab);
                  }}
                />
              ) : null}

              {weaponGroup && kind === "weapons" ? (
                <WeaponGrid
                  group={weaponGroup}
                  weapons={visibleWeapons}
                  equipped={sideLoadout.weapons}
                  weaponFilter={search}
                  selectedWeapon={activeWeaponId}
                  loading={catalogLoading}
                  error={catalogError}
                  favorites={loadout.favorites}
                  onToggleFavorite={toggleFavorite}
                  onSelectWeapon={(id) =>
                    handleWeaponClick(id, sideLoadout.weapons[id] ?? null)
                  }
                />
              ) : null}

              {tab === "knives" ? (
                <KnifeGrid
                  knives={knives}
                  equippedKnife={sideLoadout.knife}
                  filter={search}
                  selectedKnife={activeWeaponId}
                  loading={catalogLoading}
                  error={catalogError}
                  favorites={loadout.favorites}
                  onToggleFavorite={toggleFavorite}
                  onSelectKnife={(id) =>
                    handleWeaponClick(
                      id,
                      sideLoadout.knife?.weapon === id ? sideLoadout.knife : null,
                    )
                  }
                />
              ) : null}

              {tab === "gloves" ? (
                <GloveGrid
                  gloves={gloves}
                  equippedGloves={sideLoadout.gloves}
                  filter={search}
                  selectedGloves={activeWeaponId}
                  loading={catalogLoading}
                  error={catalogError}
                  favorites={loadout.favorites}
                  onToggleFavorite={toggleFavorite}
                  onSelectGloves={(id) =>
                    handleWeaponClick(
                      id,
                      sideLoadout.gloves?.weapon === id
                        ? sideLoadout.gloves
                        : null,
                    )
                  }
                />
              ) : null}

              {tab === "agents" ? (
                <AgentGrid
                  faction={side}
                  equipped={sideLoadout.agent}
                  filter={search}
                  onEquip={equipAgent}
                />
              ) : null}
            </>
          )}

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-sky-400" />
              Your loadout is saved per side. Switch between CT and T side to
              manage different loadouts.
            </p>
            {randomButton}
          </div>
        </div>

        {tab !== "agents" ? (
          <PreviewPanel
            weaponName={activeDisplayName}
            weaponId={activeWeaponId}
            weaponDefIndex={activeDef?.defIndex}
            weaponGroup={activeDef?.group}
            preview={previewItem}
            draftSkin={draftSkin}
            wear={wear}
            seed={seed}
            stattrak={stattrak}
            isFavorite={isFavorite}
            canEquip={canEquip}
            isEquipped={isCurrentEquipped}
            onWearChange={setWear}
            onSeedChange={setSeed}
            onStatTrakChange={setStatTrak}
            onBrowseSkins={
              activeWeaponId
                ? () => openSkinBrowser(activeWeaponId, equippedForActive)
                : undefined
            }
            onEquip={handleEquipFromPreview}
            onToggleFavorite={() => toggleFavorite()}
            className="hidden xl:sticky xl:top-20 xl:flex xl:self-start"
          />
        ) : null}
      </div>

      {browsingSkins &&
      tab !== "agents" &&
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
              weaponGroup={activeDef?.group}
              preview={previewItem}
              draftSkin={draftSkin}
              wear={wear}
              seed={seed}
              stattrak={stattrak}
              isFavorite={isFavorite}
              canEquip={canEquip}
              isEquipped={isCurrentEquipped}
              onWearChange={setWear}
              onSeedChange={setSeed}
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
