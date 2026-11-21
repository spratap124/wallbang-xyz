export type FirstSeenSeedRow = {
  _id: string;
  firstSeenAt: Date;
};

export const FIRST_SEEN_SEED_PIPELINE = [
  {
    $group: {
      _id: "$steamId",
      firstSeenAt: { $min: "$joinedAt" },
    },
  },
] as const;

/** Count only ledger rows created for a lifetime session start. */
export const LIFETIME_SESSION_COUNT_ACCUMULATOR = {
  $sum: { $cond: [{ $eq: ["$sessionStarted", true] }, 1, 0] },
} as const;

export function seedLeaseClaim(now: Date, token: string, leaseMs: number) {
  return {
    filter: {
      _id: "lifetime" as const,
      seededAt: { $exists: false },
      $or: [
        { seedLockUntil: { $exists: false } },
        { seedLockUntil: { $lte: now } },
      ],
    },
    update: {
      $set: {
        seedLockOwner: token,
        seedLockUntil: new Date(now.getTime() + leaseMs),
      },
    },
  };
}

export function firstSeenSetOnInsert(
  steamId: string,
  firstSeenAt: Date,
): { _id: string; steamId: string; firstSeenAt: Date } {
  return { _id: steamId, steamId, firstSeenAt };
}

export function firstSeenUpsert(
  steamId: string,
  firstSeenAt: Date,
  countAsPostBaselineUnique = false,
) {
  return {
    filter: { _id: steamId },
    update: {
      $setOnInsert: {
        ...firstSeenSetOnInsert(steamId, firstSeenAt),
        ...(countAsPostBaselineUnique
          ? { lifetimeUniqueContribution: true as const }
          : {}),
      },
    },
    upsert: true as const,
  };
}

export async function insertOrRefreshOpenSession<T extends { _id: string }>(input: {
  document: T;
  insert(document: T): Promise<void>;
  findOpen(): Promise<T | null>;
  refresh(id: string): Promise<void>;
}): Promise<boolean> {
  try {
    await input.insert(input.document);
    return true;
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const winner = await input.findOpen();
    if (!winner) throw error;
    await input.refresh(winner._id);
    return false;
  }
}

export async function finalizeSessionOnce(input: {
  finalize(): Promise<boolean>;
  credit(): Promise<void>;
}): Promise<boolean> {
  if (!(await input.finalize())) return false;
  await input.credit();
  return true;
}

export async function idempotentUpsert(write: () => Promise<void>): Promise<boolean> {
  try {
    await write();
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false;
    throw error;
  }
}

export function addLifetimeLedgerTotals(
  baseline: { totalSessions: number; totalPlayTimeMs: number },
  ledger: { totalSessions?: number; totalPlayTimeMs?: number },
) {
  return {
    totalSessions: baseline.totalSessions + (ledger.totalSessions ?? 0),
    totalPlayTimeMs:
      baseline.totalPlayTimeMs + Math.round(ledger.totalPlayTimeMs ?? 0),
  };
}

export function addPostBaselineUniquePlayers(
  baselineUniquePlayers: number,
  contributionRows: number,
): number {
  return baselineUniquePlayers + contributionRows;
}
