"use client";

import { useState } from "react";

import { AdminAuditPanel } from "@/components/admin/admin-audit-panel";
import { Button } from "@/components/ui/button";
import { getModerationCapabilities } from "@/lib/admin/moderation";
import type { PermissionCode } from "@/types/permissions";

import { ModerationBansPanel } from "./moderation-bans-panel";
import { ModerationPlayerPanel } from "./moderation-player-panel";
import { ModerationReportsPanel } from "./moderation-reports-panel";

type Section = "reports" | "bans" | "player" | "audit";

export function ModerationDashboard({
  userId,
  permissions,
}: {
  userId: string;
  permissions: PermissionCode[];
}) {
  const capabilities = getModerationCapabilities(permissions);
  const [section, setSection] = useState<Section>(
    capabilities.reviewReports ? "reports" : "bans",
  );

  const sections: { id: Section; label: string; visible: boolean }[] = [
    { id: "reports", label: "Reports inbox", visible: capabilities.reviewReports },
    { id: "bans", label: "Ban management", visible: true },
    { id: "player", label: "Player history", visible: true },
    { id: "audit", label: "Moderation audit", visible: capabilities.adminAudit },
  ];
  const visibleSections = sections.filter((item) => item.visible);
  const activeSection = visibleSections.some((item) => item.id === section)
    ? section
    : (visibleSections[0]?.id ?? "bans");

  return (
    <div className="space-y-6">
      <div className="text-muted-foreground rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm">
        Moderation actions are logged. Reports are allegations, not proof; a report never
        automatically bans a player.
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Moderation sections">
        {visibleSections.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={activeSection === item.id ? "default" : "outline"}
            aria-pressed={activeSection === item.id}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <section
        aria-label={visibleSections.find((item) => item.id === activeSection)?.label}
      >
        {activeSection === "reports" && capabilities.reviewReports ? (
          <ModerationReportsPanel viewerId={userId} />
        ) : null}
        {activeSection === "bans" ? (
          <ModerationBansPanel
            canIssueTimed={capabilities.timedBans}
            canIssuePermanent={capabilities.permanentBans}
            canRevoke={capabilities.revokeBans}
          />
        ) : null}
        {activeSection === "player" ? (
          <ModerationPlayerPanel canReviewReports={capabilities.reviewReports} />
        ) : null}
        {activeSection === "audit" && capabilities.adminAudit ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Moderation and admin audit</h2>
              <p className="text-muted-foreground text-sm">
                Uses the existing audit endpoint and permission. This log includes other
                admin actions as well as moderation events.
              </p>
            </div>
            <AdminAuditPanel />
          </div>
        ) : null}
      </section>
    </div>
  );
}
