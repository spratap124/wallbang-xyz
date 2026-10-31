import { z } from "zod";

import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { setPlayerTags } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

const bodySchema = z.object({
  targetUserId: z.string().min(1).optional(),
  targetSteamId: z.string().regex(/^\d{17}$/).optional(),
  chatTag: z.union([z.string(), z.null()]),
  nameTag: z.union([z.string(), z.null()]),
});

export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("manage_users");
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const { targetUserId, targetSteamId, chatTag, nameTag } = parsed.data;
  if (!targetUserId && !targetSteamId) {
    return jsonError("targetUserId or targetSteamId is required.", 400);
  }

  try {
    const resolved = await setPlayerTags({
      targetUserId,
      targetSteamId,
      chatTag,
      nameTag,
      grantedBy: { id: auth.user.id, steamId: auth.user.steamId },
    });
    return jsonOk(resolved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return jsonError(message, 400);
  }
}
