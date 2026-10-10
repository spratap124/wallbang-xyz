import "server-only";

import type { Filter } from "mongodb";

import {
  bansCollection,
  ensureModerationIndexes,
  reportsCollection,
} from "@/lib/moderation/collections";
import { getGameServerById } from "@/lib/servers/registry";
import { isBanCurrentlyActive, isValidSteamId64 } from "@/lib/moderation/validation";
import type {
  BanDoc,
  BanStatus,
  PlayerReportDoc,
  ReportStatus,
} from "@/types/moderation";

export { isBanCurrentlyActive, isValidSteamId64 } from "@/lib/moderation/validation";

function banView(ban: BanDoc) {
  return {
    ...ban,
    startsAt: ban.startsAt.toISOString(),
    expiresAt: ban.expiresAt?.toISOString() ?? null,
    revokedAt: ban.revokedAt?.toISOString() ?? null,
    createdAt: ban.createdAt.toISOString(),
    updatedAt: ban.updatedAt.toISOString(),
  };
}

function reportView(report: PlayerReportDoc) {
  return {
    ...report,
    assignedAt: report.assignedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

export async function createBan(input: {
  steamId: string;
  reason: string;
  permanent: boolean;
  durationHours?: number;
  createdBy: string;
  createdBySteamId: string;
  originServerId?: string | null;
}): Promise<ReturnType<typeof banView>> {
  if (!isValidSteamId64(input.steamId)) throw new Error("Invalid SteamID64.");
  if (!input.permanent && (!input.durationHours || input.durationHours <= 0)) {
    throw new Error("Timed bans require a positive duration.");
  }
  await ensureModerationIndexes();
  const now = new Date();
  const origin = input.originServerId
    ? await getGameServerById(input.originServerId, { includeDisabled: true })
    : null;
  if (input.originServerId && !origin) throw new Error("Unknown origin server.");
  const doc: BanDoc = {
    _id: crypto.randomUUID(),
    steamId: input.steamId,
    reason: input.reason.trim(),
    status: "active",
    permanent: input.permanent,
    startsAt: now,
    expiresAt: input.permanent
      ? null
      : new Date(now.getTime() + input.durationHours! * 3600000),
    createdBy: input.createdBy,
    createdBySteamId: input.createdBySteamId,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    originServerId: input.originServerId ?? null,
    originServerName: origin?.name ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await (await bansCollection()).insertOne(doc);
  return banView(doc);
}

export async function listBans(input: {
  steamId?: string;
  status?: BanStatus;
  limit: number;
}) {
  await ensureModerationIndexes();
  const filter: Filter<BanDoc> = {};
  if (input.steamId) filter.steamId = input.steamId;
  if (input.status) filter.status = input.status;
  const docs = await (
    await bansCollection()
  )
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(input.limit)
    .toArray();
  return docs.map(banView);
}

export async function getActiveBan(steamId: string, now = new Date()) {
  await ensureModerationIndexes();
  const docs = await (
    await bansCollection()
  )
    .find({ steamId, status: "active" })
    .sort({ createdAt: -1 })
    .toArray();
  const active = docs.find((ban) => isBanCurrentlyActive(ban, now));
  return active ? banView(active) : null;
}

export async function revokeBan(input: {
  banId: string;
  revokedBy: string;
  reason: string;
}) {
  await ensureModerationIndexes();
  const now = new Date();
  return (
    (await (
      await bansCollection()
    ).findOneAndUpdate(
      { _id: input.banId, status: "active" },
      {
        $set: {
          status: "revoked",
          revokedAt: now,
          revokedBy: input.revokedBy,
          revokeReason: input.reason.trim(),
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    )) ?? null
  );
}

export async function createReport(input: {
  reporterSteamId: string;
  targetSteamId: string;
  serverId: string;
  reason: string;
  details?: string | null;
}) {
  if (!isValidSteamId64(input.reporterSteamId) || !isValidSteamId64(input.targetSteamId))
    throw new Error("Invalid SteamID64.");
  if (input.reporterSteamId === input.targetSteamId)
    throw new Error("Players cannot report themselves.");
  await ensureModerationIndexes();
  const server = await getGameServerById(input.serverId, { includeDisabled: false });
  if (!server) throw new Error("Unknown or inactive server.");
  const reports = await reportsCollection();
  const recent = await reports.findOne({
    reporterSteamId: input.reporterSteamId,
    targetSteamId: input.targetSteamId,
    serverId: input.serverId,
    reason: input.reason.trim(),
    createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
  });
  if (recent) return { report: reportView(recent), duplicate: true };
  const now = new Date();
  const doc: PlayerReportDoc = {
    _id: crypto.randomUUID(),
    reporterSteamId: input.reporterSteamId,
    targetSteamId: input.targetSteamId,
    serverId: input.serverId,
    serverName: server.name,
    reason: input.reason.trim(),
    details: input.details?.trim() || null,
    status: "open",
    assignedTo: null,
    assignedAt: null,
    resolvedBy: null,
    resolution: null,
    createdAt: now,
    updatedAt: now,
  };
  await reports.insertOne(doc);
  return { report: reportView(doc), duplicate: false };
}

export async function listReports(input: {
  status?: ReportStatus;
  targetSteamId?: string;
  limit: number;
}) {
  await ensureModerationIndexes();
  const filter: Filter<PlayerReportDoc> = {};
  if (input.status) filter.status = input.status;
  if (input.targetSteamId) filter.targetSteamId = input.targetSteamId;
  const docs = await (
    await reportsCollection()
  )
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(input.limit)
    .toArray();
  return docs.map(reportView);
}

export async function updateReport(input: {
  id: string;
  status?: ReportStatus;
  assignedTo?: string | null;
  resolution?: string | null;
  actorId?: string;
}) {
  await ensureModerationIndexes();
  const $set: Partial<PlayerReportDoc> = { updatedAt: new Date() };
  if (input.status) $set.status = input.status;
  if (input.assignedTo !== undefined) {
    $set.assignedTo = input.assignedTo;
    $set.assignedAt = input.assignedTo ? new Date() : null;
  }
  if (input.resolution !== undefined) $set.resolution = input.resolution?.trim() || null;
  if (input.actorId && (input.status === "resolved" || input.status === "dismissed"))
    $set.resolvedBy = input.actorId;
  return (
    (await (
      await reportsCollection()
    ).findOneAndUpdate({ _id: input.id }, { $set }, { returnDocument: "after" })) ?? null
  );
}
