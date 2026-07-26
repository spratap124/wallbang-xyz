import { z } from "zod";

const STEAM_ID = z.string().regex(/^\d{17}$/);
const SIDE = z.enum(["T", "CT"]);

export const matchPlayerSchema = z.object({
  steamId: STEAM_ID,
  name: z.string().trim().min(1).max(64).optional(),
  avatar: z.string().trim().max(512).optional(),
  side: SIDE,
});

export const matchResultSchema = z.object({
  serverId: z.string().trim().min(1).max(64),
  map: z.string().trim().min(1).max(64),
  winner: SIDE,
  players: z.array(matchPlayerSchema).min(2).max(20),
});

export type MatchResultBody = z.infer<typeof matchResultSchema>;
