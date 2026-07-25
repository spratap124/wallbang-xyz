# WallBang Player Profile Stats Plan

**Branch:** `feature/player-profile-stats`  
**Date:** 2026-07-24  
**Product bet:** Own the server *and* the website → richer profiles than any public CS2 retake community that only shows K/D.

---

## 1. Why this matters

Most retake servers expose:

- Kills / Deaths / K/D

WallBang can differentiate with retake-specific stats, performance analytics, map/spawn heatmaps, rating history, and a round-by-round **match timeline** — possible only because we control both the CounterStrikeSharp plugin and wallbang.xyz.

**Signature feature (long-term):** per-match round timeline (plant, clutch, MVP, first death, rating Δ) with drill-down into side, spawn, loadout, damage, bomb events.

---

## 2. Current foundation (already shipped)

Sprint 1–2 player profiles are live. Competitive combat stats are **not**.

| Layer | Status |
|---|---|
| Steam identity, avatar, country, bio | Shipped |
| VIP / badges / RBAC | Shipped |
| Presence + sessions (playtime sessions) | Shipped |
| Privacy (`stats`, `matchHistory`, …) | Shipped |
| Profile UI tabs: Overview / Achievements / Activity | Shipped |
| Stats / Match History tabs | UI stubs (“coming soon”) |
| `player_stats` lifetime counters | Schema exists; **never written** by gameplay |
| Match / Round / PlayerRoundStats | **Missing** |
| Plugin combat ingest | **Missing** (presence + loadout only) |
| WallBang Rating / leaderboards | **Missing** (`leaderboards` / `statistics` flags off) |

**Key paths**

- Types: `types/profile.ts` (`PlayerStatsDoc`, `QuickStats`, `PlayerProfileView`)
- Domain: `lib/profile/{stats,service,presence,sessions,collections}.ts`
- Plugin auth pattern: `requirePluginApiKey` + `X-API-Key` (see `POST /api/v1/presence`)
- UI stubs: `components/profile/recent-matches.tsx`, `profile-stats.tsx`, `profile-tabs.tsx`
- Roadmap: Phase 2 still lists “Core player statistics pipeline”; Phase 3 lists profiles/leaderboards/match history

---

## 3. Design principle — event source of truth

**Do not store only cumulative totals.**

Store granular events so new analytics can be derived without changing the plugin every time:

```
Match
  └── Round
        └── PlayerRoundStats   ← primary fact table
```

### 3.1 Canonical event shape (plugin → web)

```json
{
  "matchId": "...",
  "round": 12,
  "steamId": "7656119...",
  "kills": 2,
  "assists": 1,
  "deaths": 0,
  "headshots": 2,
  "damage": 187,
  "damageTaken": 54,
  "site": "A",
  "side": "CT",
  "survived": true,
  "won": true,
  "mvp": false,
  "planted": false,
  "defused": false,
  "openingKill": false,
  "openingDeath": false,
  "clutch": null,
  "weapons": { "ak47": 2 },
  "utility": { "flashAssists": 0, "enemiesFlashed": 1, "heDamage": 0, "molotovDamage": 0, "smokeDamage": 0 },
  "positions": {
    "spawn": { "x": 0, "y": 0, "z": 0 },
    "death": null,
    "roundEnd": { "x": 0, "y": 0, "z": 0 }
  }
}
```

Phase 1 can ship a **subset** of these fields; schema should allow additive fields without migrations that break old events.

### 3.2 Collections (proposed)

| Collection | Purpose | Retention idea |
|---|---|---|
| `matches` | match meta (map, serverId, mode, started/ended, score, winner) | long |
| `rounds` | per-round outcome (winner, bomb site, duration) | long |
| `player_round_stats` | **fact table** — one doc per player per round | long (or tiered) |
| `player_stats` | denormalized lifetime rollup (fast profile reads) | durable |
| `player_map_stats` | per-map rollup | durable |
| `player_weapon_stats` | per-weapon rollup | durable |
| `player_rating_history` | rating samples over time | durable |
| `player_sessions` | already exists (connection time) | 30d TTL (keep) |

**Aggregation rule:** plugin posts round events → web upserts facts → async or inline rollup into `player_stats` (+ map/weapon). Lifetime docs are a **cache**, not the source of truth.

---

## 4. Four product layers

### Layer 1 — Core Player Profile (MVP)

**Identity:** Steam profile, avatar, country, WallBang Rating, VIP, current server, last seen, total playtime  

**Combat:** Kills, Deaths, Assists, K/D, ADR, HS%, Accuracy%, Damage, Rounds Played/Won/Lost, MVPs  

**Bomb:** Plants, Successful Plants, Defuses, Successful Defuses, Bomb Carries  

**Weapons:** AK / M4A1-S / M4A4 / AWP / USP-S / Deagle / Glock / Five-Seven / CZ / MP9 / MAC10 + Top weapon

### Layer 2 — Retakes-specific ⭐

Site preference (A/B rounds + win rate) · Side splits (T/CT) · Clutches (1v1…1v5) · Entry (opening K/D, entry success %, first kill %) · Survival (survival %, trade death/kill %, avg lifetime)

### Layer 3 — Performance analytics ⭐⭐⭐ (ranking signals)

Aim (HS%, TTK, spray accuracy, dmg/bullet, ADR) · Consistency (KPR, rounds with kill / multi / zero dmg) · Multi-kills (2K–ACE) · Streaks · Utility (flash assists, HE/Molly/smoke dmg)

### Layer 4 — WallBang exclusive ⭐⭐⭐⭐⭐

Rating history graph · Map stats grid · Spawn stats · Heatmaps (kill / death / plant) · Enemy stats (most killed, most died to, favorite teammate, nemesis) · Session windows (today → lifetime) · Improvement deltas (30d) · Leaderboards · Achievement badges (cosmetic only)

---

## 5. Build phases

Aligned with “what I’d build first” from product notes, mapped onto this repo.

### Phase 1 — Pipeline + Core MVP

**Goal:** Live numbers on the profile Stats tab; Match History list stops being empty.

| Workstream | Deliverable |
|---|---|
| Schema | `matches`, `rounds`, `player_round_stats`; extend `PlayerStatsDoc` |
| Plugin contract | `POST /api/v1/matches/round` (or batch `/rounds`) + match start/end |
| Aggregation | Rollup: rating (v0), K/D/A, ADR, HS%, plants, defuses, rounds, win rate, playtime, map stats |
| Profile API | Enrich `GET /api/profile/[steamId]/stats`; add recent matches endpoint |
| UI | Wire Stats tab + `RecentMatches`; show rating + core combat |
| Flags | Flip `statistics` when ready; keep `leaderboards` off |

**Out of Phase 1:** clutches, entry, heatmaps, weapon deep-dives, rating graph polish, achievements.

**Rating v0 (decision needed):** start simple (e.g. HLTV-inspired or Elo-lite on round outcomes). Document formula in this folder before shipping so leaderboards later stay honest.

### Phase 2 — Retakes depth + history

- Clutches, entry kills, multi-kills, weapon stats, streaks
- Session history windows
- Rating history series + graph
- Match detail page with **round timeline** (signature feature v1)
- Expand `player_stats` / derived views; privacy gates for match history

### Phase 3 — Platform differentiators

- Heatmaps (round-end / death / plant positions)
- Aim analytics that need finer plugin telemetry
- Enemy / teammate comparisons
- Achievements (no gameplay advantage)
- Seasonal leaderboards + personal bests
- Enable `leaderboards` flag + public pages

---

## 6. Plugin ↔ web contract (Phase 1 draft)

Mirror existing presence ingest:

- Auth: `X-API-Key: PLUGIN_API_KEY`
- Validate `serverId` against fleet registry
- Zod schemas; idempotent upserts on `(matchId, round, steamId)`

**Suggested endpoints**

| Endpoint | When | Body |
|---|---|---|
| `POST /api/v1/matches/start` | New retake match | `matchId`, `serverId`, `map`, `startedAt` |
| `POST /api/v1/matches/round` | End of each round | matchId + round meta + `players[]` of PlayerRoundStats |
| `POST /api/v1/matches/end` | Match over | `matchId`, score, winner, `endedAt` |

Prefer **one round POST with all players** over N per-player calls (fewer round-trips mid-match).

**Plugin work lives in Wallbang-CS2-Server** (separate repo) — this plan owns the web contract; plugin implementation tracks the same field names.

Idempotency: re-sending the same round must not double-count lifetime rollups (store `appliedToRollup: true` or use deterministic increment keys).

---

## 7. Profile UX mapping

| Tab / surface | Phase | Data |
|---|---|---|
| Overview quick stats | 1 | Extended `QuickStats` (ADR, rating, rounds) |
| Stats tab | 1 → 2 | Layer 1 then Layer 2 cards |
| Match History tab | 1 | Recent matches list |
| Match detail `/profile/.../match/[id]` | 2 | Round timeline + drill-down |
| Leaderboards `/leaderboards` | 3 | Seasonal boards |
| Achievements | 3 | Unlock feed (reuse activity types) |

Respect existing privacy settings (`stats`, `matchHistory`).

---

## 8. Open decisions

Resolve before or during Phase 1 implementation:

1. **Rating formula v0** — Elo on match win? Round-weighted? Damage-inclusive?
2. **What is a “match” in retakes?** — Plugin-defined session (N rounds) vs map change vs player count threshold.
3. **Playtime source of truth** — continue `player_sessions` vs also credit from match wall-clock.
4. **Heatmap storage** — store raw positions in round facts vs aggregate grids server-side (privacy + size).
5. **Retention** — keep every round forever vs downsample after 90d (keep rollups).
6. **Cross-repo sequencing** — web ingest + fake fixtures first vs plugin emit first.

**Recommended default:** web ingest + fixture/seed path first so UI can ship against synthetic rounds; plugin wires second.

---

## 9. Implementation slices (Phase 1 checklist)

Use as the execution board on this branch:

- [x] Types for `MatchDoc`, `RoundDoc`, `PlayerRoundStatsDoc`; extend `PlayerStatsDoc` + `QuickStats`
- [x] Collections + indexes (`matchId+round+steamId` unique; rating history + map stats)
- [x] `POST /api/v1/matches/start|round|end` with plugin auth
- [x] Rollup service: apply round → lifetime + map stats (idempotent)
- [x] Docs: plugin payload examples (`docs/player-profile-stats/ingest.md`)
- [ ] `GET` stats + recent matches APIs (privacy-aware) — stats GET exists; extend for ADR/rating/map
- [ ] Seed/fixture script for local + staging demos
- [ ] Wire Stats tab + Recent Matches UI
- [ ] Staging verify on `wallbang-oc`; keep prod dark until Phase 1 stable

---

## 10. Success criteria (Phase 1)

1. After a real (or fixture) match, profile shows non-zero K/D, ADR, HS%, plants/defuses, rounds, win rate.
2. Match History lists that match with map + score + K/D.
3. Re-ingesting the same round does not inflate stats.
4. Privacy `stats: private` hides numbers from non-owners.
5. No gameplay advantage — cosmetics/achievements only later.

---

## 11. Non-goals (near term)

- Pay-to-win ranking boosts
- FACEIT/ESEA import
- Full demo parsing (plugin events only for v1)
- Replacing admin fleet session KPIs (separate domain)

---

## References

- Product vision: four layers + Match→Round→PlayerRoundStats (conversation 2026-07-24)
- Existing profile Sprint 1–2 (`feat/player-profile`, merged)
- Plugin auth precedent: `docs/player-loadout-sync.md`, `app/api/v1/presence/route.ts`
- Public roadmap: `content/roadmap.ts` Phase 2–3
