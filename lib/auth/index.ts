export {
  authConfig,
  getSiteUrl,
  isSteamAuthConfigured,
} from "@/lib/auth/config";
export { getSession, clearSessionCookie } from "@/lib/auth/session";
export type { AuthUser, SessionPayload } from "@/types/auth";
