/**
 * Provision website users from SteamID64 (no Steam login required) and grant VIP.
 *
 * Usage:
 *   npm run grant:vip -- 76561198xxxxxxxxxxxxx 76561198xxxxxxxxxxxxx
 *   npm run grant:vip -- --months 3 76561198xxxxxxxxxxxxx
 *   npm run grant:vip -- --dry-run 76561198xxxxxxxxxxxxx
 *
 * Requires MONGODB_URI, MONGODB_DB, STEAM_API_KEY (via --env-file=.env.local).
 * To target production Atlas: MONGODB_DB=wallbang npm run grant:vip -- ...
 */
import { MongoClient, ObjectId } from "mongodb";

import { ROLE_PRIORITY } from "../lib/permissions/constants";
import type { RoleCode, RoleSource } from "../types/permissions";

const STEAM_ID_RE = /^\d{17}$/;

type SteamPlayerRaw = {
  steamid: string;
  personaname?: string;
  avatarfull?: string;
  avatarmedium?: string;
  avatar?: string;
  profileurl?: string;
};

type CliOptions = {
  dryRun: boolean;
  months: number | null;
  source: RoleSource;
  steamIds: string[];
};

function highestRole(roles: RoleCode[]): RoleCode {
  if (roles.length === 0) return "USER";
  return roles.reduce((best, role) =>
    ROLE_PRIORITY[role] > ROLE_PRIORITY[best] ? role : best,
  );
}

function parseArgs(argv: string[]): CliOptions {
  const steamIds: string[] = [];
  let dryRun = false;
  let months: number | null = null;
  let source: RoleSource = "MANUAL";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--months") {
      const raw = argv[i + 1];
      const parsed = Number.parseInt(raw ?? "", 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("--months requires a positive integer.");
      }
      months = parsed;
      i += 1;
      continue;
    }
    if (arg === "--source") {
      const raw = argv[i + 1];
      if (
        raw !== "MANUAL" &&
        raw !== "PURCHASE" &&
        raw !== "TOURNAMENT" &&
        raw !== "PROMOTION" &&
        raw !== "FOUNDING" &&
        raw !== "GIVEAWAY" &&
        raw !== "SYSTEM"
      ) {
        throw new Error(`Invalid --source ${raw ?? "(missing)"}.`);
      }
      source = raw;
      i += 1;
      continue;
    }
    if (arg === "--") continue;
    if (arg.startsWith("-")) {
      throw new Error(`Unknown flag ${arg}.`);
    }
    if (!STEAM_ID_RE.test(arg)) {
      throw new Error(`Invalid SteamID64: ${arg}`);
    }
    steamIds.push(arg);
  }

  return { dryRun, months, source, steamIds: [...new Set(steamIds)] };
}

async function fetchSteamProfiles(
  steamIds: string[],
  apiKey: string,
): Promise<
  Map<
    string,
    {
      steamId: string;
      personaName: string;
      avatarUrl: string;
      profileUrl: string;
    }
  >
> {
  const url = new URL(
    "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamids", steamIds.join(","));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Steam Web API error (${response.status}).`);
  }

  const data = (await response.json()) as {
    response?: { players?: SteamPlayerRaw[] };
  };
  const map = new Map<
    string,
    {
      steamId: string;
      personaName: string;
      avatarUrl: string;
      profileUrl: string;
    }
  >();

  for (const player of data.response?.players ?? []) {
    if (!player.steamid) continue;
    map.set(player.steamid, {
      steamId: player.steamid,
      personaName:
        player.personaname?.trim() || `Player ${player.steamid.slice(-4)}`,
      avatarUrl:
        player.avatarfull || player.avatarmedium || player.avatar || "",
      profileUrl:
        player.profileurl ||
        `https://steamcommunity.com/profiles/${player.steamid}`,
    });
  }

  return map;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB ?? "wallbang";
  const steamKey = process.env.STEAM_API_KEY;

  if (!uri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }
  if (!steamKey) {
    console.error("STEAM_API_KEY is not set.");
    process.exit(1);
  }
  if (options.steamIds.length === 0) {
    console.error("Pass one or more 17-digit SteamID64 values.");
    process.exit(1);
  }

  const profiles = await fetchSteamProfiles(options.steamIds, steamKey);
  const expiresAt =
    options.months == null
      ? null
      : (() => {
          const date = new Date();
          date.setMonth(date.getMonth() + options.months);
          return date;
        })();

  console.log(
    `${options.dryRun ? "[dry-run] " : ""}Granting VIP in "${dbName}"` +
      ` source=${options.source}` +
      ` expires=${expiresAt ? expiresAt.toISOString() : "never"}`,
  );

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const now = new Date();

  const users = db.collection<{
    _id: string;
    steamId: string;
    personaName: string;
    avatarUrl: string;
    profileUrl: string;
    role: RoleCode;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date;
  }>("users");
  const rolesCol = db.collection<{ _id: string; code: RoleCode }>("roles");
  const userRoles = db.collection<{
    _id: string;
    userId: string;
    roleId: string;
    roleCode: RoleCode;
    source: string;
    grantedBy: string | null;
    grantedAt: Date;
    expiresAt: Date | null;
    active: boolean;
  }>("user_roles");
  const audit = db.collection("audit_logs");
  const badges = db.collection("player_badges");
  const activity = db.collection("player_activity");

  const roleDocs = await rolesCol.find({ code: { $in: ["USER", "VIP"] } }).toArray();
  const roleByCode = new Map(roleDocs.map((role) => [role.code, role]));
  if (!roleByCode.has("USER") || !roleByCode.has("VIP")) {
    console.error('Role catalog missing USER/VIP. Run "npm run seed:permissions" first.');
    process.exit(1);
  }

  let granted = 0;
  let alreadyVip = 0;
  let createdUsers = 0;

  for (const steamId of options.steamIds) {
    const profile = profiles.get(steamId);
    if (!profile) {
      console.error(`  ✗ ${steamId} — Steam profile not found`);
      continue;
    }

    const existing = await users.findOne({ steamId });
    const userId = existing?._id ?? crypto.randomUUID();
    const isNew = !existing;

    if (!options.dryRun) {
      await users.updateOne(
        { steamId },
        {
          $set: {
            personaName: profile.personaName,
            avatarUrl: profile.avatarUrl,
            profileUrl: profile.profileUrl,
            updatedAt: now,
          },
          $setOnInsert: {
            _id: userId,
            steamId,
            role: "USER",
            createdAt: now,
            lastLoginAt: now,
          },
        },
        { upsert: true },
      );
    }

    if (isNew) createdUsers += 1;

    const user = options.dryRun
      ? existing ?? {
          _id: userId,
          steamId,
          personaName: profile.personaName,
          avatarUrl: profile.avatarUrl,
          profileUrl: profile.profileUrl,
          role: "USER" as RoleCode,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
        }
      : await users.findOne({ steamId });
    if (!user) {
      console.error(`  ✗ ${profile.personaName} (${steamId}) — user upsert failed`);
      continue;
    }

    const activeVip = await userRoles.findOne({
      userId: user._id,
      roleCode: "VIP",
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });

    if (activeVip) {
      alreadyVip += 1;
      console.log(
        `  • ${profile.personaName} (${steamId}) — already VIP` +
          ` source=${activeVip.source}` +
          ` expires=${activeVip.expiresAt ? activeVip.expiresAt.toISOString() : "never"}`,
      );
      continue;
    }

    if (!options.dryRun) {
      const userRole = roleByCode.get("USER");
      const vipRole = roleByCode.get("VIP");
      if (!userRole || !vipRole) continue;

      const existingUserRole = await userRoles.findOne({
        userId: user._id,
        roleCode: "USER",
        active: true,
      });
      if (!existingUserRole) {
        await userRoles.insertOne({
          _id: crypto.randomUUID(),
          userId: user._id,
          roleId: userRole._id,
          roleCode: "USER",
          source: "SYSTEM",
          grantedBy: null,
          grantedAt: now,
          expiresAt: null,
          active: true,
        });
      }

      await userRoles.updateMany(
        { userId: user._id, roleCode: "VIP", active: true },
        { $set: { active: false } },
      );

      const assignmentId = crypto.randomUUID();
      await userRoles.insertOne({
        _id: assignmentId,
        userId: user._id,
        roleId: vipRole._id,
        roleCode: "VIP",
        source: options.source,
        grantedBy: null,
        grantedAt: now,
        expiresAt,
        active: true,
      });

      const activeAssignments = await userRoles
        .find({
          userId: user._id,
          active: true,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        })
        .project({ roleCode: 1 })
        .toArray();
      const displayRole = highestRole(
        activeAssignments.map((row) => row.roleCode as RoleCode),
      );
      await users.updateOne(
        { _id: user._id },
        { $set: { role: displayRole, updatedAt: now } },
      );

      await audit.insertOne({
        _id: new ObjectId(),
        adminId: null,
        adminSteamId: null,
        action: "GRANT_ROLE",
        targetUserId: user._id,
        targetSteamId: steamId,
        targetPersonaName: profile.personaName,
        oldValue: null,
        newValue: {
          roleCode: "VIP",
          source: options.source,
          expiresAt,
          assignmentId,
          provisionedWithoutLogin: isNew,
        },
        timestamp: now,
      });

      const existingBadge = await badges.findOne({
        steamId,
        badgeType: "VIP",
      });
      if (!existingBadge) {
        await badges.insertOne({
          _id: new ObjectId(),
          steamId,
          badgeType: "VIP",
          grantedAt: now,
          grantedBy: null,
          metadata: { sourceRole: "VIP", source: options.source },
        });
        await activity.insertOne({
          _id: new ObjectId(),
          steamId,
          type: "got_vip",
          title: "Got VIP",
          description: "Unlocked the VIP badge.",
          metadata: { badgeType: "VIP" },
          createdAt: now,
        });
      }
    }

    granted += 1;
    console.log(
      `  ✓ ${profile.personaName} (${steamId})` +
        `${isNew ? " [new user]" : ""}` +
        `${options.dryRun ? " [dry-run]" : " → VIP"}`,
    );
  }

  await client.close();
  console.log(
    `\nDone. createdUsers=${createdUsers} granted=${granted} alreadyVip=${alreadyVip}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
