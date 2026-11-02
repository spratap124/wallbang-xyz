import "server-only";

import { getSteamApiKey } from "@/lib/auth/config";

export type SteamPlayerSummary = {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
};

type SteamPlayerRaw = {
  steamid: string;
  personaname?: string;
  avatarfull?: string;
  avatarmedium?: string;
  avatar?: string;
  profileurl?: string;
};

type SteamSummariesResponse = {
  response?: {
    players?: SteamPlayerRaw[];
  };
};

export async function fetchSteamPlayerSummary(
  steamId: string,
): Promise<SteamPlayerSummary> {
  const [player] = await fetchSteamPlayerSummaries([steamId]);
  if (!player) throw new Error("Steam profile not found.");
  return player;
}

/** Reads public Steam profile data only; it never creates a WallBang account. */
export async function fetchSteamPlayerSummaries(
  steamIds: string[],
): Promise<SteamPlayerSummary[]> {
  const ids = [...new Set(steamIds.filter(Boolean))];
  if (!ids.length) return [];
  const key = getSteamApiKey();
  const url = new URL(
    "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
  );
  url.searchParams.set("key", key);
  url.searchParams.set("steamids", ids.join(","));

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Steam Web API error (${response.status}).`);
  }

  const data = (await response.json()) as SteamSummariesResponse;
  return (data.response?.players ?? []).filter((player) => player.steamid).map((player) => ({
    steamId: player.steamid,
    personaName: player.personaname?.trim() || `Player ${player.steamid.slice(-4)}`,
    avatarUrl: player.avatarfull || player.avatarmedium || player.avatar || "",
    profileUrl: player.profileurl || `https://steamcommunity.com/profiles/${player.steamid}`,
  }));
}
