import type { RoleCode, RoleSource } from "../types/permissions";

/** Marker written on seeded docs so cleanup can find them safely. */
export const DUMMY_SEED_TAG = "wb-dummy-rbac";

export type DummyUserFixture = {
  steamId: string;
  personaName: string;
  /** Extra roles beyond baseline USER. */
  roles: Array<{
    roleCode: RoleCode;
    source: RoleSource;
    /** Days until expiry; omit for never. */
    expiresInDays?: number;
  }>;
};

/**
 * Fake SteamID64s in the 9000… range — never collide with real Steam accounts
 * (real IDs are typically 7656119…).
 */
export const DUMMY_USERS: DummyUserFixture[] = [
  {
    steamId: "90000000000000001",
    personaName: "[TEST] Plain User",
    roles: [],
  },
  {
    steamId: "90000000000000002",
    personaName: "[TEST] VIP Player",
    roles: [{ roleCode: "VIP", source: "PURCHASE", expiresInDays: 30 }],
  },
  {
    steamId: "90000000000000003",
    personaName: "[TEST] Founding Member",
    roles: [{ roleCode: "FOUNDING_MEMBER", source: "FOUNDING" }],
  },
  {
    steamId: "90000000000000004",
    personaName: "[TEST] Moderator",
    roles: [{ roleCode: "MODERATOR", source: "MANUAL" }],
  },
  {
    steamId: "90000000000000005",
    personaName: "[TEST] Admin",
    roles: [{ roleCode: "ADMIN", source: "MANUAL" }],
  },
  {
    steamId: "90000000000000006",
    personaName: "[TEST] VIP + Mod",
    roles: [
      { roleCode: "VIP", source: "GIVEAWAY", expiresInDays: 90 },
      { roleCode: "MODERATOR", source: "PROMOTION" },
    ],
  },
];

export const DUMMY_STEAM_IDS = DUMMY_USERS.map((u) => u.steamId);
