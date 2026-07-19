"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ProfileCompletionBar } from "@/components/profile/profile-completion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PlayerProfileView } from "@/types/profile";

const WEAPON_SUGGESTIONS = [
  "AK-47",
  "M4A1-S",
  "M4A4",
  "AWP",
  "Desert Eagle",
  "Glock-18",
  "USP-S",
];

const MAP_SUGGESTIONS = [
  "Mirage",
  "Dust2",
  "Inferno",
  "Nuke",
  "Ancient",
  "Anubis",
  "Vertigo",
  "Overpass",
];

type ProfilePrefsFormProps = {
  profile: PlayerProfileView;
};

export function ProfilePrefsForm({ profile }: ProfilePrefsFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(
    profile.displayName !== profile.personaName ? profile.displayName : "",
  );
  const [bio, setBio] = useState(profile.bio ?? "");
  const [countryCode, setCountryCode] = useState(profile.countryCode ?? "");
  const [favoriteWeapon, setFavoriteWeapon] = useState(
    profile.summary.favoriteWeapon ?? "",
  );
  const [favoriteMap, setFavoriteMap] = useState(
    profile.summary.favoriteMap ?? "",
  );
  const [preferredSide, setPreferredSide] = useState<"" | "T" | "CT">(
    profile.summary.preferredSide ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: displayName.trim() || null,
            bio: bio.trim() || null,
            countryCode: countryCode.trim() || null,
            favoriteWeapon: favoriteWeapon.trim() || null,
            favoriteMap: favoriteMap.trim() || null,
            preferredSide: preferredSide || null,
          }),
        });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setError(json.error ?? "Failed to save preferences.");
          return;
        }
        setSaved(true);
        router.refresh();
      } catch {
        setError("Failed to save preferences.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <ProfileCompletionBar
        completion={profile.summary.completion}
        showChecklist
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={profile.personaName}
            maxLength={64}
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use your Steam name ({profile.personaName}).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="countryCode">Country (ISO)</Label>
          <Input
            id="countryCode"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
            placeholder="IN"
            maxLength={2}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="preferredSide">Preferred side</Label>
          <select
            id="preferredSide"
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={preferredSide}
            onChange={(e) =>
              setPreferredSide(e.target.value as "" | "T" | "CT")
            }
            disabled={pending}
          >
            <option value="">Not set</option>
            <option value="T">T</option>
            <option value="CT">CT</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="favoriteWeapon">Favorite weapon</Label>
          <Input
            id="favoriteWeapon"
            list="weapon-suggestions"
            value={favoriteWeapon}
            onChange={(e) => setFavoriteWeapon(e.target.value)}
            placeholder="AK-47"
            maxLength={64}
            disabled={pending}
          />
          <datalist id="weapon-suggestions">
            {WEAPON_SUGGESTIONS.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="favoriteMap">Favorite map</Label>
          <Input
            id="favoriteMap"
            list="map-suggestions"
            value={favoriteMap}
            onChange={(e) => setFavoriteMap(e.target.value)}
            placeholder="Mirage"
            maxLength={64}
            disabled={pending}
          />
          <datalist id="map-suggestions">
            {MAP_SUGGESTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short line about how you play."
            maxLength={280}
            rows={3}
            disabled={pending}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? (
        <p className="text-sm text-emerald-400">Preferences saved.</p>
      ) : null}

      <Button size="sm" onClick={() => void onSave()} disabled={pending}>
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </div>
  );
}
