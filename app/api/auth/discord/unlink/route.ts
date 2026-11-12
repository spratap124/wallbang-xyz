import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requireSession } from "@/lib/permissions/authz";
import { unlinkDiscordAccount } from "@/lib/auth/users";
import { rateLimit } from "@/lib/rate-limit";

export async function DELETE(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limited = rateLimit(`discord-unlink:${ip}`, 10, 60_000);
  if (!limited.ok) {
    return jsonError("Too many unlink attempts. Try again shortly.", 429);
  }

  const found = await unlinkDiscordAccount(auth.user.id);
  if (!found) {
    return jsonError("WallBang account not found.", 404);
  }

  return jsonOk({ unlinked: true });
}
