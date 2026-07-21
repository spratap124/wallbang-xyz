export async function submitGiveawayEntry({
  apiUrl,
  apiKey,
  steamId,
  discordUserId,
  discordUsername,
}) {
  const response = await fetch(`${apiUrl}/api/v1/discord/giveaway-entry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      steamId,
      discordUserId,
      discordUsername,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    const message =
      payload?.error ??
      `Giveaway API failed (${response.status} ${response.statusText})`;
    return { ok: false, error: message };
  }

  return { ok: true, data: payload.data };
}
