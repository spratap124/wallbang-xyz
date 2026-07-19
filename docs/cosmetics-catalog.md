# Cosmetics catalog sync (CS2 → wallbang.xyz)

The CS2 `GenerateSkinDatabase` tool packages gun skins (from Valve `items_game.txt`) plus curated knife/glove catalogs and POSTs them into MongoDB for the loadout / skin-changer UI.

## APIs

### Ingest (plugin / VPS → web)

```http
POST /api/v1/catalog/cosmetics
X-API-Key: <PLUGIN_API_KEY>
Content-Type: application/json
```

- Auth: same `PLUGIN_API_KEY` as presence / player routes
- Body: schema version 1 snapshot (weapons, weaponSkins, knives, gloves, wearPresets, contentHash)
- Idempotent: identical `contentHash` → `{ unchanged: true }`
- nginx `client_max_body_size` is **5m** (catalog is typically &lt; 1 MB)

### Plugin read

```http
GET /api/v1/catalog/cosmetics?include=meta|weapons|skins|knives|gloves|all
X-API-Key: <PLUGIN_API_KEY>
```

Optional `?weapon=ak47` when `include=skins`.

### Public UI

```http
GET /api/skins
GET /api/skins?weapon=ak47
GET /api/skins?category=knives
GET /api/skins?knife=karambit
GET /api/skins?category=gloves
GET /api/skins?glove=driver
```

No API key. Used by loadout helpers in `lib/loadout/api-client.ts` and `lib/loadout/catalog-data.ts`.

Weapon ids are **CS2 catalog ids** (`usp_silencer`, `m4a1_silencer`, `hkp2000`, …).

## Mongo collections

| Collection | Role |
|------------|------|
| `cosmetics_catalog_meta` | Active snapshot pointer (`_id: "active"`) |
| `cosmetics_weapons` | Per-weapon rows keyed by `version` |
| `cosmetics_skins` | Per `{ weaponId, paintKit }` rows |
| `cosmetics_knives` | Curated knife finishes snapshot |
| `cosmetics_gloves` | Curated glove skins snapshot |

## Env

| Variable | Where | Notes |
|----------|-------|-------|
| `PLUGIN_API_KEY` | wallbang.xyz `.env` | Must match VPS push key |
| `MONGODB_URI` / `MONGODB_DB` | wallbang.xyz | Required for ingest/read |
| `WALLBANG_PLUGIN_API_KEY` | CS2 VPS | Same value as `PLUGIN_API_KEY` |
| `WALLBANG_CATALOG_URL` | CS2 VPS | Default `https://wallbang.xyz/api/v1/catalog/cosmetics` |

Staging (`wallbang-oc`) and prod (`wallbang-hostinger`) should each point at the matching site DB + key.

## Push from CS2 repo

```bash
cd ~/Wallbang-CS2-Server
./tools/GenerateSkinDatabase/extract_from_vpk.sh
python3 ./tools/GenerateSkinDatabase/generate.py
export WALLBANG_PLUGIN_API_KEY='…'   # = site PLUGIN_API_KEY
python3 ./tools/GenerateSkinDatabase/package_catalog.py --push
```

Or `generate.py --push` after a successful generate.

Also run `package_catalog.py --push` after hand-editing curated `WallBang.Knife/knives.json` or `WallBang.Gloves/gloves.json`.

## Images

Valve extract has no preview images. Optional paintKit → CDN map lives in `lib/loadout/skin-images.json` (empty by default). Populate later without changing the ingest contract.

## Loadout UI wiring

- Server: `lib/loadout/catalog-data.ts` (`fetchSkinsForWeapon`, knife/glove helpers)
- Client: `lib/loadout/api-client.ts` → `/api/skins`
- Types: `types/loadout.ts`, `types/catalog.ts`
