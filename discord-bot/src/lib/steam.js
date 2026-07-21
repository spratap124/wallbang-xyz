const STEAM_PROFILE_RE =
  /https?:\/\/(?:www\.)?steamcommunity\.com\/profiles\/(\d{17})\b/i;

export function extractSteamIdFromText(text) {
  const match = text.match(STEAM_PROFILE_RE);
  return match?.[1] ?? null;
}

export function isValidSteamProfileLink(text) {
  return STEAM_PROFILE_RE.test(text);
}
