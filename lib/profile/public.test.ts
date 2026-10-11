import assert from "node:assert/strict";
import test from "node:test";

import { canViewerAccess } from "@/lib/profile/privacy";
import {
  PRIVATE_PROFILE_FIELDS,
  PUBLIC_PROFILE_FIELDS,
  canViewSteamId,
  isValidSteamId64,
  toAnonymousPublicProfile,
  toPublicPlayerProfile,
} from "@/lib/profile/public";
import type { PlayerProfileView, QuickStats } from "@/types/profile";

function stats(overrides: Partial<QuickStats> = {}): QuickStats {
  return {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    winRate: null,
    kills: 0,
    deaths: 0,
    assists: 0,
    kd: null,
    headshots: 0,
    headshotPercent: null,
    damage: 0,
    adr: null,
    roundsPlayed: 0,
    roundsWon: 0,
    roundsLost: 0,
    roundWinRate: null,
    plants: 0,
    plantAttempts: 0,
    defuses: 0,
    defuseAttempts: 0,
    mvps: 0,
    rating: 0,
    hoursPlayed: 0,
    ...overrides,
  };
}

function profileView(overrides: Partial<PlayerProfileView> = {}): PlayerProfileView {
  return {
    steamId: "76561198865074734",
    userId: "internal-user-id",
    personaName: "Steam Persona",
    displayName: "WallBang Name",
    avatarUrl: "https://avatars.example/a.jpg",
    steamProfileUrl: "https://steamcommunity.com/profiles/76561198865074734",
    bannerUrl: null,
    countryCode: "IN",
    bio: "retake enjoyer",
    role: "USER",
    isVip: false,
    showWebsiteBadge: false,
    joinedAt: "2026-01-02T00:00:00.000Z",
    lastLoginAt: "2026-10-01T00:00:00.000Z",
    profileViews: 12,
    isOwner: false,
    summary: {
      steamId: "76561198865074734",
      memberSince: "2026-01-02T00:00:00.000Z",
      lastLoginAt: "2026-10-01T00:00:00.000Z",
      role: "USER",
      profileCompletion: 42,
      completion: { percent: 42, items: [] },
      currentServer: null,
      favoriteWeapon: "ak47",
      favoriteMap: "de_mirage",
      preferredSide: "T",
    },
    stats: stats(),
    badges: [],
    privacy: {
      stats: "public",
      matchHistory: "public",
      steamInventory: "public",
      activity: "public",
    },
    ...overrides,
  };
}

test("validates SteamID64 as a 17-digit decimal string", () => {
  assert.equal(isValidSteamId64("76561198865074734"), true);
  assert.equal(isValidSteamId64("7656119886507473"), false);
  assert.equal(isValidSteamId64("765611988650747345"), false);
  assert.equal(isValidSteamId64("7656119886507473x"), false);
  assert.equal(isValidSteamId64("STEAM_0:1:12345"), false);
  assert.equal(isValidSteamId64(""), false);
});

test("unknown profile projects to null so callers can answer not-found", () => {
  assert.equal(toPublicPlayerProfile(null), null);
});

test("public projection exposes only allowlisted fields", () => {
  const publicProfile = toPublicPlayerProfile(profileView());
  assert.ok(publicProfile);

  const keys = Object.keys(publicProfile);
  for (const key of keys) {
    assert.ok(
      (PUBLIC_PROFILE_FIELDS as readonly string[]).includes(key),
      `unexpected public field: ${key}`,
    );
  }
  for (const privateField of PRIVATE_PROFILE_FIELDS) {
    assert.equal(
      Object.hasOwn(publicProfile, privateField),
      false,
      `private field leaked: ${privateField}`,
    );
  }
});

test("public projection never carries private account or contact data", () => {
  const publicProfile = toPublicPlayerProfile(profileView());
  assert.ok(publicProfile);

  const serialized = JSON.stringify(publicProfile);
  assert.equal(Object.hasOwn(publicProfile, "userId"), false);
  assert.equal(Object.hasOwn(publicProfile, "privacy"), false);
  assert.equal(Object.hasOwn(publicProfile, "email"), false);
  assert.equal(Object.hasOwn(publicProfile, "personaName"), false);
  assert.doesNotMatch(serialized, /internal-user-id/);
  assert.doesNotMatch(serialized, /@/);
  assert.doesNotMatch(serialized, /token|password|secret/i);
  // Summary must drop completion gamification and the nested SteamID.
  assert.equal(Object.hasOwn(publicProfile.summary, "profileCompletion"), false);
  assert.equal(Object.hasOwn(publicProfile.summary, "completion"), false);
  assert.equal(Object.hasOwn(publicProfile.summary, "steamId"), false);
});

test("public projection keeps stats when the player shares them", () => {
  const publicProfile = toPublicPlayerProfile(
    profileView({ stats: stats({ matchesPlayed: 8, wins: 5, kd: 1.42 }) }),
  );
  assert.ok(publicProfile);
  assert.equal(publicProfile.stats.matchesPlayed, 8);
  assert.equal(publicProfile.stats.kd, 1.42);
  assert.equal(publicProfile.statsHidden, false);
});

test("private stats are flagged and redacted for anonymous viewers", () => {
  const publicProfile = toPublicPlayerProfile(
    profileView({
      stats: stats({ matchesPlayed: 0, kd: null }),
      statsHidden: true,
    }),
  );
  assert.ok(publicProfile);
  assert.equal(publicProfile.statsHidden, true);
  assert.equal(publicProfile.stats.matchesPlayed, 0);
});

test("missing server activity is represented as null, not an error", () => {
  const publicProfile = toPublicPlayerProfile(profileView({ serverActivity: null }));
  assert.ok(publicProfile);
  assert.equal(publicProfile.serverActivity, null);
});

test("available server activity survives the projection", () => {
  const publicProfile = toPublicPlayerProfile(
    profileView({
      serverActivity: {
        sessions: 4,
        playTimeMs: 3_600_000,
        firstSeenAt: "2026-09-01T10:00:00.000Z",
        lastSeenAt: "2026-10-01T10:00:00.000Z",
        windowDays: 30,
      },
    }),
  );
  assert.ok(publicProfile);
  assert.equal(publicProfile?.serverActivity?.sessions, 4);
  assert.equal(publicProfile?.serverActivity?.windowDays, 30);
});

test("privacy levels gate non-owner access without leaking data", () => {
  assert.equal(canViewerAccess("public", false), true);
  assert.equal(canViewerAccess("friends", false), false);
  assert.equal(canViewerAccess("private", false), false);
  assert.equal(canViewerAccess("private", true), true);
});

test("SteamID64 is visible to owners and admins only", () => {
  assert.equal(canViewSteamId({ isOwner: false, isAdmin: false }), false);
  assert.equal(canViewSteamId({ isOwner: false, isAdmin: true }), true);
  assert.equal(canViewSteamId({ isOwner: true, isAdmin: false }), true);
});

test("public API payload omits SteamID64 for non-owner non-admin viewers", () => {
  const publicProfile = toPublicPlayerProfile(profileView());
  assert.ok(publicProfile);
  assert.equal(publicProfile.steamId, "76561198865074734");

  const anonymous = toAnonymousPublicProfile(publicProfile);
  assert.equal(Object.hasOwn(anonymous, "steamId"), false);
  assert.doesNotMatch(
    JSON.stringify(anonymous),
    /76561198865074734/,
    "SteamID64 leaked into the anonymous payload",
  );
  // Everything else survives the redaction.
  assert.equal(anonymous.displayName, "WallBang Name");
  assert.equal(anonymous.stats.matchesPlayed, 0);
});
