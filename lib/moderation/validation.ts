import type { BanDoc } from "@/types/moderation";

const STEAM_ID64 = /^\d{17}$/;

export function isValidSteamId64(value: string): boolean {
  return STEAM_ID64.test(value);
}

export function isBanCurrentlyActive(
  ban: Pick<BanDoc, "status" | "startsAt" | "expiresAt">,
  now = new Date(),
): boolean {
  return (
    ban.status === "active" &&
    ban.startsAt <= now &&
    (ban.expiresAt === null || ban.expiresAt > now)
  );
}
