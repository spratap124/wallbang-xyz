import "server-only";

import { findDiscordUserIdsByUserIds, findUsersBySteamIds } from "@/lib/auth/users";
import { ensurePlayerIndexes, playersCollection } from "@/lib/rating/RatingRepository";
import { userRolesCollection } from "@/lib/permissions/collections";

/** WallBang identities eligible for the bot-managed Discord roles. */
export async function getDiscordRoleSyncTargets(): Promise<{
  vipDiscordUserIds: string[];
  topTenDiscordUserIds: string[];
}> {
  const now = new Date();
  const assignments = await userRolesCollection()
    .then((collection) =>
      collection
        .find(
          {
            roleCode: "VIP",
            active: true,
            $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
          },
          { projection: { _id: 0, userId: 1 } },
        )
        .toArray(),
    );
  const vipDiscordUserIds = await findDiscordUserIdsByUserIds(
    assignments.map((assignment) => assignment.userId),
  );

  await ensurePlayerIndexes();
  const players = await (await playersCollection())
    .find({}, { projection: { _id: 0, steamId: 1 } })
    .sort({ rating: -1, steamId: 1 })
    .limit(10)
    .toArray();
  const topTenUsers = await findUsersBySteamIds(
    players.map((player) => player.steamId),
  );
  const topTenDiscordUserIds = await findDiscordUserIdsByUserIds(
    topTenUsers.map((user) => user._id),
  );

  return {
    vipDiscordUserIds: [...new Set(vipDiscordUserIds)],
    topTenDiscordUserIds: [...new Set(topTenDiscordUserIds)],
  };
}
