import { FeatureFlagsPanel } from "@/components/admin/feature-flags-panel";
import type { FeatureFlags } from "@/config/features.flags";
import { isMongoConfigured } from "@/lib/mongo";
import { parseOwnerSteamIds } from "@/lib/permissions/constants";

type AdminSettingsPanelProps = {
  featureFlags: FeatureFlags;
};

export function AdminSettingsPanel({ featureFlags }: AdminSettingsPanelProps) {
  const owners = parseOwnerSteamIds();

  return (
    <div className="grid max-w-3xl gap-4">
      <FeatureFlagsPanel initialFlags={featureFlags} />

      <section className="rounded-xl border border-border bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Environment</h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex justify-between gap-3">
            <span className="text-muted-foreground">MongoDB</span>
            <span>{isMongoConfigured() ? "Configured" : "Missing"}</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-muted-foreground">Owner SteamIDs</span>
            <span>{owners.length}</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-muted-foreground">Discord bot token</span>
            <span>
              {process.env.DISCORD_BOT_TOKEN?.trim()
                ? "Configured"
                : "Not set"}
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
