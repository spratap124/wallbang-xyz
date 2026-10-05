"use client";

export type VipServerOption = {
  id: string;
  label: string;
  hasAccess: boolean;
};

export const ALL_RETAKES_KEY = "all_retakes";

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
  selectedKeys,
  onToggle,
}: {
  servers: VipServerOption[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
}) {
  const allServersSelected = selectedKeys.includes(ALL_RETAKES_KEY);

  if (servers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No servers in the fleet registry.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
        <input
          type="checkbox"
          className="size-3.5 accent-foreground"
          checked={allServersSelected}
          onChange={() => onToggle(ALL_RETAKES_KEY)}
        />
        <span className="font-medium">All servers</span>
        <span className="text-xs text-muted-foreground">
          All Retakes Bundle · {servers.length} server
          {servers.length === 1 ? "" : "s"}
        </span>
      </label>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {servers.map((server) => (
          <label
            key={server.id}
            className={`flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm ${
              allServersSelected ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              className="size-3.5 accent-foreground"
              disabled={allServersSelected}
              checked={allServersSelected || selectedKeys.includes(server.id)}
              onChange={() => onToggle(server.id)}
            />
            <span className="min-w-0 flex-1 truncate">{server.label}</span>
            {server.hasAccess ? (
              <span className="text-xs text-muted-foreground">active</span>
            ) : null}
          </label>
        ))}
      </div>
    </div>
  );
}
