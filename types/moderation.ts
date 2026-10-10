export const BAN_STATUSES = ["active", "revoked"] as const;
export type BanStatus = (typeof BAN_STATUSES)[number];

export const REPORT_STATUSES = ["open", "assigned", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export type BanDoc = {
  _id: string;
  steamId: string;
  reason: string;
  status: BanStatus;
  permanent: boolean;
  startsAt: Date;
  expiresAt: Date | null;
  createdBy: string;
  createdBySteamId: string;
  revokedAt: Date | null;
  revokedBy: string | null;
  revokeReason: string | null;
  originServerId: string | null;
  originServerName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlayerReportDoc = {
  _id: string;
  reporterSteamId: string;
  targetSteamId: string;
  serverId: string;
  serverName: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  assignedTo: string | null;
  assignedAt: Date | null;
  resolvedBy: string | null;
  resolution: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BanView = Omit<
  BanDoc,
  "createdAt" | "updatedAt" | "startsAt" | "expiresAt" | "revokedAt"
> & {
  createdAt: string;
  updatedAt: string;
  startsAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

export type ReportView = Omit<
  PlayerReportDoc,
  "createdAt" | "updatedAt" | "assignedAt"
> & {
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
};
