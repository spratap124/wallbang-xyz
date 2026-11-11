import "server-only";

import { ReadPreference, type ClientSession } from "mongodb";

import { getDb, getMongoClient } from "@/lib/mongo";

export type VipEntitlementTransaction = {
  session: ClientSession;
};

/**
 * Serializes entitlement mutations for one player through a write to that
 * player's existing users document. The history and role writes must run in
 * the same transaction. MongoDB retries write conflicts, so a losing purchase
 * rereads the authoritative vip_history after the winner commits.
 *
 * This adds only an optional version field to users; it is not a projection of
 * entitlement state and can be ignored or removed without rebuilding history.
 */
export async function withVipEntitlementTransaction<T>(input: {
  userId: string;
  run: (transaction: VipEntitlementTransaction) => Promise<T>;
}): Promise<T> {
  const client = await getMongoClient();
  const db = await getDb();
  const session = client.startSession();
  let result!: T;
  let completed = false;

  try {
    await session.withTransaction(
      async () => {
        const fence = await db.collection<{ _id: string }>("users").updateOne(
          { _id: input.userId },
          { $inc: { vipEntitlementVersion: 1 } },
          { session },
        );
        if (fence.matchedCount !== 1) {
          throw new Error(`VIP entitlement owner ${input.userId} was not found.`);
        }
        result = await input.run({ session });
        completed = true;
        return result;
      },
      {
        readPreference: ReadPreference.primary,
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );
    if (!completed) throw new Error("VIP entitlement transaction did not complete.");
    return result;
  } finally {
    await session.endSession();
  }
}
