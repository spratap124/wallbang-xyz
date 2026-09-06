"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  writableFeatureFlags,
  type FeatureFlags,
  type WritableFeatureFlag,
} from "@/config/features.flags";
import type { ApiResult } from "@/lib/api/waitlist";
import { cn } from "@/lib/utils";

type FeatureFlagsPanelProps = {
  initialFlags: FeatureFlags;
};

const writableFlags = new Set<string>(writableFeatureFlags);

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

export function FeatureFlagsPanel({ initialFlags }: FeatureFlagsPanelProps) {
  const [flags, setFlags] = useState(initialFlags);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleFlag(key: WritableFeatureFlag) {
    const next = !flags[key];
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/v1/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      const payload = await readJson<FeatureFlags>(response);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setFlags(payload.data);
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card/40 p-5">
      <h2 className="text-sm font-semibold">Feature flags</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Most flags are code/env only. Page flags (VIP, Loadout, Features, Profile,
        Settings) and VIP checkout flags can be toggled here. Saved values override
        FEATURE_* env vars.
      </p>
      {error ? (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      ) : null}
      <ul className="mt-4 divide-y divide-border/60 text-sm">
        {Object.entries(flags).map(([key, value]) => {
          const writable = writableFlags.has(key);

          return (
            <li
              key={key}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="font-mono text-xs">{key}</span>
              {writable ? (
                <Button
                  type="button"
                  size="sm"
                  variant={value ? "default" : "outline"}
                  disabled={pending}
                  onClick={() => toggleFlag(key as WritableFeatureFlag)}
                  className={cn(
                    "h-7 min-w-14 px-3 text-xs",
                    value && "bg-emerald-600 hover:bg-emerald-600/90",
                  )}
                >
                  {value ? "on" : "off"}
                </Button>
              ) : (
                <span
                  className={
                    value ? "text-emerald-400" : "text-muted-foreground"
                  }
                >
                  {value ? "on" : "off"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
