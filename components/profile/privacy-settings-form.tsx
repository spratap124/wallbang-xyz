"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PrivacyLevel, PrivacySettings } from "@/types/profile";

const SECTIONS: Array<{
  key: keyof PrivacySettings;
  label: string;
  description: string;
}> = [
  {
    key: "stats",
    label: "Stats",
    description: "Quick stats and detailed performance numbers",
  },
  {
    key: "matchHistory",
    label: "Match History",
    description: "Recent match results and scores",
  },
  {
    key: "steamInventory",
    label: "Steam Inventory",
    description: "Inventory showcase on your profile",
  },
  {
    key: "activity",
    label: "Activity",
    description: "Timeline of profile events",
  },
];

const LEVELS: Array<{ value: PrivacyLevel; label: string }> = [
  { value: "public", label: "Public" },
  { value: "friends", label: "Friends Only" },
  { value: "private", label: "Private" },
];

type PrivacySettingsFormProps = {
  initial: PrivacySettings;
};

export function PrivacySettingsForm({ initial }: PrivacySettingsFormProps) {
  const router = useRouter();
  const [privacy, setPrivacy] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function update(key: keyof PrivacySettings, value: PrivacyLevel) {
    setPrivacy((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ privacy }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          error?: string;
        };
        if (!res.ok || !json.ok) {
          setError(json.error ?? "Failed to save privacy settings.");
          return;
        }
        setSaved(true);
        router.refresh();
      } catch {
        setError("Failed to save privacy settings.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map((section) => (
        <div
          key={section.key}
          className="flex flex-col gap-3 rounded-lg bg-secondary/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <Label htmlFor={`privacy-${section.key}`}>{section.label}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {section.description}
            </p>
          </div>
          <select
            id={`privacy-${section.key}`}
            className="h-8 rounded-md border border-border bg-background px-2 font-mono text-xs"
            value={privacy[section.key]}
            onChange={(e) =>
              update(section.key, e.target.value as PrivacyLevel)
            }
            disabled={pending}
          >
            {LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        Friends Only behaves like Private until the friends graph ships.
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? (
        <p className="text-sm text-emerald-400">Privacy settings saved.</p>
      ) : null}

      <Button size="sm" onClick={() => void onSave()} disabled={pending}>
        {pending ? "Saving…" : "Save privacy"}
      </Button>
    </div>
  );
}
