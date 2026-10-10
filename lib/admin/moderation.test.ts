import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterReports,
  getBanDisplayStatus,
  getModerationCapabilities,
  isValidSteamId64,
  orderReportsPendingFirst,
} from "./moderation";
import type { BanView, ReportView } from "@/types/moderation";

const ban = (overrides: Partial<BanView> = {}): BanView => ({
  _id: "ban-1",
  steamId: "76561198000000000",
  reason: "Testing",
  status: "active",
  permanent: false,
  startsAt: "2026-10-01T00:00:00.000Z",
  expiresAt: "2026-10-02T00:00:00.000Z",
  createdBy: "admin-id",
  createdBySteamId: "76561198000000001",
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  originServerId: null,
  originServerName: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

const report = (overrides: Partial<ReportView> = {}): ReportView => ({
  _id: "report-1",
  reporterSteamId: "76561198000000000",
  targetSteamId: "76561198000000001",
  serverId: "retake-1-mumbai",
  serverName: "Retake #1",
  reason: "Griefing",
  details: null,
  status: "open",
  assignedTo: null,
  assignedAt: null,
  resolvedBy: null,
  resolution: null,
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-10T10:00:00.000Z",
  ...overrides,
});

describe("moderation dashboard helpers", () => {
  it("validates SteamID64 as exactly 17 decimal digits", () => {
    assert.equal(isValidSteamId64("76561198000000000"), true);
    assert.equal(isValidSteamId64("7656119800000000"), false);
    assert.equal(isValidSteamId64("76561198000000000x"), false);
  });

  it("distinguishes active, expired, scheduled, and revoked bans", () => {
    const now = Date.parse("2026-10-10T12:00:00.000Z");
    assert.equal(
      getBanDisplayStatus(ban({ permanent: true, expiresAt: null }), now),
      "active",
    );
    assert.equal(
      getBanDisplayStatus(ban({ expiresAt: "2026-10-11T00:00:00.000Z" }), now),
      "active",
    );
    assert.equal(getBanDisplayStatus(ban(), now), "expired");
    assert.equal(getBanDisplayStatus(ban({ status: "revoked" }), now), "revoked");
    assert.equal(
      getBanDisplayStatus(ban({ startsAt: "2026-10-11T00:00:00.000Z" }), now),
      "scheduled",
    );
  });

  it("sorts pending reports ahead of completed reports, then newest first", () => {
    const sorted = orderReportsPendingFirst([
      report({ _id: "resolved", status: "resolved" }),
      report({ _id: "open-old", createdAt: "2026-10-09T10:00:00.000Z" }),
      report({ _id: "assigned", status: "assigned" }),
      report({ _id: "open-new" }),
    ]);
    assert.deepEqual(
      sorted.map((item) => item._id),
      ["open-new", "open-old", "assigned", "resolved"],
    );
  });

  it("filters report records by reason, server, target, and date", () => {
    const reports = [
      report(),
      report({
        _id: "other-server",
        serverId: "retake-2-mumbai",
        reason: "Abusive behaviour",
        createdAt: "2026-10-09T10:00:00.000Z",
      }),
    ];
    assert.deepEqual(
      filterReports(reports, {
        reason: "Griefing",
        serverId: "retake-1-mumbai",
        targetSteamId: "76561198000000001",
        from: "2026-10-10",
        to: "2026-10-10",
      }).map((item) => item._id),
      ["report-1"],
    );
  });

  it("derives UI actions from explicit permissions", () => {
    const moderator = getModerationCapabilities([
      "moderation_access",
      "issue_timed_bans",
      "review_reports",
    ]);
    assert.equal(moderator.access, true);
    assert.equal(moderator.timedBans, true);
    assert.equal(moderator.permanentBans, false);
    assert.equal(moderator.revokeBans, false);

    const admin = getModerationCapabilities([
      "moderation_access",
      "issue_timed_bans",
      "issue_permanent_bans",
      "revoke_bans",
      "review_reports",
      "admin_panel",
    ]);
    assert.equal(admin.permanentBans, true);
    assert.equal(admin.revokeBans, true);
    assert.equal(admin.adminAudit, true);
  });
});
