"use client";

export type VipServerOption = {
  id: string;
  label: string;
  hasAccess: boolean;
  pricingByPlan?: Partial<Record<"1_month" | "3_months" | "6_months" | "1_year", number>>;
};
export type VipBundleOption = { id: string; label: string; serverCount: number; serverIds: string[]; pricingByPlan?: Partial<Record<"1_month" | "3_months" | "6_months" | "1_year", number>> };

// Canonical bundle used for all future all-server grants. Keep the constant
// name for callers, but never create new grants with the legacy key.
export const ALL_RETAKES_KEY = "mumbai-retake-bundle-all";

export function nextEntitlementKeys(keys: string[], key: string): string[] {
  if (key === ALL_RETAKES_KEY) {
    return keys.includes(ALL_RETAKES_KEY) ? [] : [ALL_RETAKES_KEY];
  }
  const withoutBundle = keys.filter((item) => item !== ALL_RETAKES_KEY);
  return withoutBundle.includes(key)
    ? withoutBundle.filter((item) => item !== key)
    : [...withoutBundle, key];
}

export function VipServerPicker({
  servers,
  bundles = [],
  selectedKeys,
  onToggle,
}: {
  servers: VipServerOption[];
  bundles?: VipBundleOption[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
}) {
  if (servers.length === 0 && bundles.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No servers in the fleet registry.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {bundles.length > 0 ? <section className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Bundles</p>
        {bundles.map((bundle) => <label key={bundle.id} className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
          <input type="checkbox" className="size-3.5 accent-foreground" checked={selectedKeys.includes(bundle.id)} onChange={() => onToggle(bundle.id)} />
          <span className="min-w-0 flex-1">{bundle.label}</span><span className="text-xs text-muted-foreground">{bundle.serverCount} servers</span>
        </label>)}
        {bundles.filter((bundle) => selectedKeys.includes(bundle.id)).map((bundle) => <p key={`${bundle.id}-preview`} className="pl-6 text-xs text-muted-foreground">Includes: {bundle.serverIds.map((id) => servers.find((server) => server.id === id)?.label ?? id).join(", ")}</p>)}
      </section> : null}
      <section className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Individual servers</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {servers.map((server) => (
          <label
            key={server.id}
            className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              className="size-3.5 accent-foreground"
              checked={selectedKeys.includes(server.id)}
              onChange={() => onToggle(server.id)}
            />
            <span className="min-w-0 flex-1 truncate">{server.label}</span>
            {server.hasAccess ? (
              <span className="text-xs text-muted-foreground">active</span>
            ) : null}
          </label>
        ))}
      </div>
      </section>
    </div>
  );
}
