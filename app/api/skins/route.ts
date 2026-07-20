import {
  CatalogNotFoundError,
  getActiveCatalogMeta,
  getGloveDetail,
  getGlovesCatalog,
  getKnifeDetail,
  getKnivesCatalog,
  listSkinsForWeapon,
  listWeapons,
  toLoadoutSkins,
  toWeaponDefs,
} from "@/lib/loadout/catalog";
import {
  resolveSkinImage,
  resolveSkinImageByName,
} from "@/lib/loadout/images";
import { lookupSkinMetadata } from "@/lib/loadout/skin-metadata";
import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk } from "@/lib/permissions/authz";

export const runtime = "nodejs";

/**
 * Public cosmetics catalog for the loadout / skin-changer UI.
 *
 * GET /api/skins
 * GET /api/skins?weapon=ak47
 * GET /api/skins?category=knives
 * GET /api/skins?knife=karambit
 * GET /api/skins?category=gloves
 * GET /api/skins?glove=driver
 */
export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const url = new URL(request.url);
  const weapon = url.searchParams.get("weapon")?.trim();
  const knife = url.searchParams.get("knife")?.trim();
  const glove = url.searchParams.get("glove")?.trim();
  const category = url.searchParams.get("category")?.trim().toLowerCase();

  try {
    if (weapon) {
      const [{ skins }, { weapons }] = await Promise.all([
        listSkinsForWeapon(weapon),
        listWeapons(),
      ]);
      const weaponDef = weapons.find((w) => w.id === weapon);
      const displayName = weaponDef?.displayName ?? weapon;
      const weaponRef = {
        id: weapon,
        defIndex: weaponDef?.defIndex,
      };
      const byId = new Map(skins.map((s) => [s.id, s]));
      return jsonOk({
        weapon,
        skins: toLoadoutSkins(
          weapon,
          skins,
          (paintKit, skinId) => {
            const skin = byId.get(skinId);
            return (
              resolveSkinImage(weaponRef, paintKit) ??
              (skin
                ? resolveSkinImageByName(`${displayName}|${skin.name}`)
                : undefined)
            );
          },
          { defIndex: weaponDef?.defIndex, name: displayName },
        ),
      });
    }

    if (knife) {
      const detail = await getKnifeDetail(knife);
      const weaponRef = {
        id: detail.knife.id,
        defIndex: detail.knife.defIndex,
      };
      return jsonOk({
        ...detail,
        finishes: detail.finishes.map((f) => ({
          ...f,
          image:
            resolveSkinImage(weaponRef, f.paintKit) ??
            resolveSkinImageByName(
              `${detail.knife.displayName}|${f.displayName}`,
            ),
        })),
      });
    }

    if (glove) {
      const detail = await getGloveDetail(glove);
      const weaponRef = {
        id: detail.glove.id,
        defIndex: detail.glove.defIndex,
      };
      return jsonOk({
        glove: detail.glove,
        wearPresets: detail.wearPresets,
        skins: detail.glove.skins.map((s) => {
          const meta = lookupSkinMetadata({
            weaponId: detail.glove.id,
            defIndex: detail.glove.defIndex,
            paintKit: s.paintKit,
            skinName: s.displayName,
            weaponDisplayName: detail.glove.displayName,
          });
          return {
            id: `${detail.glove.id}:${s.id}`,
            weapon: detail.glove.id,
            paintKit: s.paintKit,
            skinName: s.displayName,
            rarity: meta?.rarity ?? "Extraordinary",
            collection: meta?.collection ?? "",
            wearSupported: true,
            stattrakSupported: false,
            image:
              resolveSkinImage(weaponRef, s.paintKit) ??
              resolveSkinImageByName(
                `${detail.glove.displayName}|${s.displayName}`,
              ),
          };
        }),
      });
    }

    if (category === "knives") {
      const catalog = await getKnivesCatalog();
      return jsonOk({
        knives: catalog.knives.map((k) => ({
          id: k.id,
          name: k.displayName,
          group: "Knives",
          category: "knives" as const,
          weapon: k.weapon,
          defIndex: k.defIndex,
          finishSet: k.finishSet ?? null,
        })),
        finishSets: catalog.finishSets,
        wearPresets: catalog.wearPresets,
      });
    }

    if (category === "gloves") {
      const catalog = await getGlovesCatalog();
      return jsonOk({
        gloves: catalog.gloves.map((g) => ({
          id: g.id,
          name: g.displayName,
          group: "Gloves",
          category: "gloves" as const,
          defIndex: g.defIndex,
          skinCount: g.skins.length,
        })),
        wearPresets: catalog.wearPresets,
      });
    }

    // Default: weapons index
    const { weapons, wearPresets, meta } = await listWeapons();
    const defs = toWeaponDefs(weapons);
    const categories: Record<string, typeof defs> = {};
    for (const w of defs) {
      (categories[w.group] ??= []).push(w);
    }

    return jsonOk({
      weapons: defs,
      categories,
      wearPresets,
      manifest: meta.manifest,
      generatedAt: meta.generatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof CatalogNotFoundError) {
      // Empty catalog is a soft empty response for the public UI.
      if (!weapon && !knife && !glove && !category) {
        const meta = await getActiveCatalogMeta().catch(() => null);
        if (!meta) {
          return jsonOk({
            weapons: [],
            categories: {},
            wearPresets: {
              weapons: [],
              knives: [],
              gloves: [],
            },
            manifest: null,
            generatedAt: null,
          });
        }
      }
      return jsonError(err.message, 404);
    }
    console.error("[api/skins] failed", err);
    return jsonError("Failed to load skins catalog.", 500);
  }
}
