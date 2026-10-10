import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import type { BanDoc, PlayerReportDoc } from "@/types/moderation";

const BANS = "player_bans";
const REPORTS = "player_reports";
let indexesReady: Promise<void> | null = null;

export async function bansCollection(): Promise<Collection<BanDoc>> {
  return (await getDb()).collection<BanDoc>(BANS);
}

export async function reportsCollection(): Promise<Collection<PlayerReportDoc>> {
  return (await getDb()).collection<PlayerReportDoc>(REPORTS);
}

export async function ensureModerationIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const [bans, reports] = await Promise.all([bansCollection(), reportsCollection()]);
      await Promise.all([
        bans.createIndex({ steamId: 1, createdAt: -1 }),
        bans.createIndex({ steamId: 1, status: 1, expiresAt: 1 }),
        bans.createIndex({ status: 1, expiresAt: 1, createdAt: -1 }),
        reports.createIndex({ status: 1, createdAt: -1 }),
        reports.createIndex({ targetSteamId: 1, createdAt: -1 }),
        reports.createIndex({ serverId: 1, createdAt: -1 }),
        reports.createIndex({ reporterSteamId: 1, createdAt: -1 }),
      ]);
    })().catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  return indexesReady;
}
