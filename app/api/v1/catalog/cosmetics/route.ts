import {
  CatalogNotFoundError,
  getActiveCatalogMeta,
  getGlovesCatalog,
  getKnivesCatalog,
  ingestCosmeticsCatalog,
  listSkinsForWeapon,
  listWeapons,
} from "@/lib/loadout/catalog";
import { cosmeticsCatalogIngestSchema } from "@/lib/loadout/schema";
import { isMongoConfigured } from "@/lib/mongo";
import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";

export const runtime = "nodejs";

/**
 * CS2 GenerateSkinDatabase → web cosmetics catalog ingest.
 *
 * POST /api/v1/catalog/cosmetics
 * Headers: X-API-Key: <PLUGIN_API_KEY>
 */
export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = cosmeticsCatalogIngestSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "Invalid catalog payload.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    const result = await ingestCosmeticsCatalog(parsed.data);
    return jsonOk(result);
  } catch (err) {
    console.error("[catalog/cosmetics] ingest failed", err);
    return jsonError("Failed to ingest cosmetics catalog.", 500);
  }
}

/**
 * Plugin/admin read of the active catalog.
 *
 * GET /api/v1/catalog/cosmetics?include=meta|weapons|skins|knives|gloves|all
 * Optional: ?weapon=ak47 when include includes skins
 */
export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const includeRaw = (url.searchParams.get("include") ?? "meta").toLowerCase();
  const include = new Set(
    includeRaw.split(",").map((s) => s.trim()).filter(Boolean),
  );
  const wantAll = include.has("all");

  try {
    const meta = await getActiveCatalogMeta();
    if (!meta) {
      return jsonError("Cosmetics catalog has not been ingested yet.", 404);
    }

    const data: Record<string, unknown> = {
      version: meta.version,
      contentHash: meta.contentHash,
      source: meta.source,
      schemaVersion: meta.schemaVersion,
      generatedAt: meta.generatedAt.toISOString(),
      ingestedAt: meta.ingestedAt.toISOString(),
      manifest: meta.manifest,
      wearPresets: meta.wearPresets,
    };

    if (wantAll || include.has("weapons")) {
      const { weapons } = await listWeapons();
      data.weapons = weapons;
    }

    if (wantAll || include.has("skins")) {
      const weaponId = url.searchParams.get("weapon");
      if (weaponId) {
        data.weaponSkins = await listSkinsForWeapon(weaponId);
      } else if (wantAll) {
        const { weapons } = await listWeapons();
        const groups = await Promise.all(
          weapons.map((w) => listSkinsForWeapon(w.id)),
        );
        data.weaponSkins = groups;
      } else {
        return jsonError(
          "Query param weapon= is required when include=skins (or use include=all).",
          400,
        );
      }
    }

    if (wantAll || include.has("knives")) {
      data.knives = await getKnivesCatalog();
    }

    if (wantAll || include.has("gloves")) {
      data.gloves = await getGlovesCatalog();
    }

    return jsonOk(data);
  } catch (err) {
    if (err instanceof CatalogNotFoundError) {
      return jsonError(err.message, 404);
    }
    console.error("[catalog/cosmetics] read failed", err);
    return jsonError("Failed to read cosmetics catalog.", 500);
  }
}
