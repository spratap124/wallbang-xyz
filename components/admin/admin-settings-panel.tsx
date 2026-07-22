import { featureFlags } from "@/config/features.flags";
import { isMongoConfigured } from "@/lib/mongo";
import { parseOwnerSteamIds } from "@/lib/permissions/constants";

export function AdminSettingsPanel() {
  const owners = parseOwnerSteamIds();

  return (
    <div className="grid max-w-3xl gap-4">
      <section className="rounded-xl border border-border bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Feature flags</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Read-only snapshot from server config. Change via deploy env / code.
        </p>
        <ul className="mt-4 divide-y divide-border/60 text-sm">
          {Object.entries(featureFlags).map(([key, value]) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="font-mono text-xs">{key}</span>
              <span
                className={
                  value ? "text-emerald-400" : "text-muted-foreground"
                }
              >
                {value ? "on" : "off"}
              </span>
            </li>
          ))}
        </ul>
      </section>

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
