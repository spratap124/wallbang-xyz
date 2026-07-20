# Player loadout sync (web ↔ CS2 server)

Persisted loadouts live in MongoDB (`player_loadouts`). The website loadout UI and CS2 plugins share the same document via these endpoints.

## Web (Steam session)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/loadout` | Session cookie | Load full UI loadout for signed-in user |
| PUT | `/api/loadout` | Session cookie | Save full UI loadout (weapons, knife, gloves, agents, favorites) |

## CS2 plugin (API key)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/player/:steamId` | `X-API-Key` | Permissions + **game loadout** on join |
| PATCH | `/api/v1/player/:steamId/loadout` | `X-API-Key` | Merge in-game selections from `!skins` / `!knife` / `!gloves` / agent menus |

Header: `X-API-Key: <PLUGIN_API_KEY>` (same as presence and permissions routes).

### GET `/api/v1/player/:steamId` — loadout shape

```json
{
  "ok": true,
  "data": {
    "player": { "steamId": "7656119…", "username": "Player" },
    "roles": ["VIP"],
    "permissions": ["reserved_slot"],
    "loadout": {
      "weapons": {
        "ak47": {
          "weaponId": "ak47",
          "skinId": "asiimov",
          "paintKit": 302,
          "patternSeed": 42,
          "wear": 0.12,
          "statTrak": true
        }
      },
      "knife": {
        "knifeId": "karambit",
        "finishId": "doppler_p1",
        "paintKit": 415,
        "patternSeed": 0,
        "wear": 0.08,
        "statTrak": false
      },
      "gloves": {
        "gloveId": "sport_gloves",
        "skinId": "vice",
        "paintKit": 10006,
        "patternSeed": 0,
        "wear": 0.15
      },
      "agentCT": { "agentId": "agent_jamison", "name": "Cmdr. Mae …", "faction": "CT" },
      "agentT": { "agentId": "agent_vypa", "name": "Vypa …", "faction": "T" },
      "updatedAt": "2026-07-20T10:00:00.000Z"
    }
  }
}
```

`loadout` is `null` when the player has never saved a loadout.

### PATCH `/api/v1/player/:steamId/loadout` — merge in-game picks

Send only the slots that changed. Omitted slots are left unchanged.

```json
{
  "weapons": {
    "ak47": {
      "paintKit": 302,
      "skinId": "asiimov",
      "wear": 0.12,
      "patternSeed": 42,
      "statTrak": true
    }
  }
}
```

Knife after `!knife`:

```json
{
  "knife": {
    "knifeId": "karambit",
    "paintKit": 38,
    "finishId": "fade",
    "wear": 0.04,
    "statTrak": false
  }
}
```

Gloves after `!gloves`:

```json
{
  "gloves": {
    "gloveId": "sport_gloves",
    "paintKit": 10006,
    "wear": 0.15
  }
}
```

Clear a slot with `null`:

```json
{ "knife": null }
```

Response matches GET `/api/loadout` (`loadout`, `game`, `updatedAt`).

---

## Changes required in `wallbang-cs2-server`

These are **not implemented in this repo** — apply them in the CS2 plugin project.

### 1. `WallBangApiClient` — parse agents from player response

Extend `PlayerLoadout` / `GameLoadout` DTO to include:

```csharp
public GameAgent? AgentCT { get; set; }
public GameAgent? AgentT { get; set; }

public class GameAgent
{
    public string AgentId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Faction { get; set; } = ""; // "CT" | "T"
}
```

JSON property names: `agentCT`, `agentT` (camelCase).

### 2. `WallBangApiClient` — add loadout PATCH helper

```csharp
public async Task<bool> PatchPlayerLoadoutAsync(
    string steamId,
    object patchBody,
    CancellationToken ct = default)
{
    // PATCH {BaseUrl}/api/v1/player/{steamId}/loadout
    // Header: X-API-Key
    // Body: partial weapons / knife / gloves / agentCT / agentT
}
```

Run PATCH **after** the player confirms a selection in the in-game menu (fire-and-forget or await with logging; do not block gameplay).

### 3. `WallBang.Skins` — sync on `!skins` selection

When a player equips a weapon skin via the menu:

1. Apply locally (existing behavior).
2. Call `PatchPlayerLoadoutAsync(steamId, new { weapons = new Dictionary<string, object> { [weaponId] = new { paintKit, wear, patternSeed, statTrak, skinId } } })`.

Weapon ids must match the web catalog (`ak47`, `m4a1_silencer`, `usp_silencer`, etc.).

### 4. `WallBang.Knife` — sync on `!knife` selection

```csharp
await api.PatchPlayerLoadoutAsync(steamId, new {
    knife = new {
        knifeId = selection.KnifeId,
        paintKit = selection.PaintKit,
        finishId = selection.FinishId,
        wear = selection.Wear,
        patternSeed = selection.Seed,
        statTrak = selection.StatTrak
    }
});
```

### 4. `WallBang.Gloves` — sync on `!gloves` selection

Same pattern with `gloves: { gloveId, paintKit, wear, patternSeed, skinId }`.

### 5. Agent plugin (if present) — sync agent picks

```csharp
await api.PatchPlayerLoadoutAsync(steamId, new {
    agentCT = new { agentId, faction = "CT", name = optionalDisplayName }
});
```

### 6. On player connect — apply web loadout (already started)

In `WallBang.Permissions` (or Skins/Knife/Gloves on spawn):

1. `GET /api/v1/player/{steamId}` (existing).
2. If `data.loadout` is non-null, map to plugin selection models and apply once per session.
3. Prefer web loadout on **first spawn**; in-game menu changes should update both local state **and** PATCH back to web so the website stays in sync.

### 7. Id mapping checklist

| Web / API | CS2 plugin |
|-----------|------------|
| `weaponId` / catalog id | `ak47`, `m4a1_silencer`, … |
| `knifeId` | catalog knife id (`karambit`, …) |
| `gloveId` | catalog glove id (`sport_gloves`, …) |
| `paintKit` | Valve paint kit index |
| `patternSeed` | 0–999 |
| `wear` | 0.0–1.0 float |

### 8. Error handling

- PATCH failures should log a warning; do not kick the player.
- If GET loadout fails on join, fall back to server-local prefs (current behavior).
- Website PUT and plugin PATCH both upsert the same Mongo document; last write wins per slot.

---

## MongoDB

Collection: `player_loadouts`

```json
{
  "steamId": "76561198000000000",
  "userId": "<users._id or steamId if never logged into web>",
  "loadout": { /* UserLoadoutState */ },
  "updatedAt": "ISODate(...)"
}
```

Indexes: unique `steamId`, unique `userId`.
