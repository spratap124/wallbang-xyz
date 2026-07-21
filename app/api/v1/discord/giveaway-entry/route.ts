import { z } from "zod";

import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import { processGiveawayEntry } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

const bodySchema = z.object({
  steamId: z.string().regex(/^\d{17}$/),
  discordUserId: z.string().min(1),
  discordUsername: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("Invalid request body.", 400, parsed.error.flatten()
      .fieldErrors as Record<string, string[]>);
  }

  const maxWinners = Number.parseInt(
    process.env.GIVEAWAY_MAX_WINNERS ?? "100",
    10,
  );

  try {
    const result = await processGiveawayEntry({
      ...parsed.data,
      maxWinners: Number.isFinite(maxWinners) ? maxWinners : 100,
    });
    return jsonOk(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Giveaway entry failed.";
    return jsonError(message, 400);
  }
}
