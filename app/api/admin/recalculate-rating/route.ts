import { isMongoConfigured } from "@/lib/mongo";
import {
  jsonError,
  jsonOk,
  requirePermission,
} from "@/lib/permissions/authz";
import { ratingService } from "@/lib/rating/RatingService";

export const runtime = "nodejs";

/**
 * POST /api/admin/recalculate-rating
 *
 * Re-derive every player's rank from their stored rating
 * (e.g. after changing RANK_THRESHOLDS). Does not replay Elo.
 * Auth: manage_users session permission.
 */
export async function POST(): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("manage_users");
  if ("response" in auth) return auth.response;

  const result = await ratingService.recalculateRanks();
  return jsonOk(result);
}
