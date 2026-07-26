import { z } from "zod";

import type { RatingEvent } from "@/types/rating";
import { RATING_EVENT_VERSION } from "@/types/rating";

const STEAM_ID = z.string().regex(/^\d{17}$/);
const SIDE = z.enum(["T", "CT"]);

export const matchPlayerSchema = z.object({
  steamId: STEAM_ID,
  name: z.string().trim().min(1).max(64).optional(),
  avatar: z.string().trim().max(512).optional(),
  side: SIDE,
});

/** @deprecated Prefer roundResultSchema for public retakes. */
export const matchResultSchema = z.object({
  serverId: z.string().trim().min(1).max(64),
  map: z.string().trim().min(1).max(64),
  winner: SIDE,
  players: z.array(matchPlayerSchema).min(2).max(20),
});

export type MatchResultBody = z.infer<typeof matchResultSchema>;

export const roundPlayerSchema = z.object({
  steamId: STEAM_ID,
  name: z.string().trim().min(1).max(64).optional(),
  avatar: z.string().trim().max(512).optional(),
  side: SIDE,
  kills: z.number().int().min(0).max(64),
  assists: z.number().int().min(0).max(64),
  headshots: z.number().int().min(0).max(64),
  damage: z.number().int().min(0).max(10_000),
  survived: z.boolean(),
  plant: z.boolean(),
  defuse: z.boolean(),
  entryKill: z.boolean(),
  mvp: z.boolean(),
});

export const roundResultSchema = z.object({
  /** Payload version — defaults to 1 so older clients stay compatible. */
  version: z.literal(RATING_EVENT_VERSION).default(RATING_EVENT_VERSION),
  serverId: z.string().trim().min(1).max(64),
  map: z.string().trim().min(1).max(64),
  winner: SIDE,
  roundNumber: z.number().int().min(1).max(64).optional(),
  players: z.array(roundPlayerSchema).min(1).max(20),
});

export type RoundResultBody = z.infer<typeof roundResultSchema>;

/**
 * Validates raw POST /api/rounds bodies and maps them to RatingEvent.
 * Keeps the HTTP controller thin — the rating engine only sees RatingEvent.
 */
export class RoundValidator {
  parse(json: unknown): RatingEvent {
    const parsed = roundResultSchema.safeParse(json);
    if (!parsed.success) {
      const err = new RoundValidationError(
        "Invalid request body.",
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
      throw err;
    }
    return this.toRatingEvent(parsed.data);
  }

  toRatingEvent(body: RoundResultBody): RatingEvent {
    return {
      version: body.version,
      serverId: body.serverId,
      map: body.map,
      roundNumber: body.roundNumber,
      winner: body.winner,
      players: body.players,
    };
  }
}

export class RoundValidationError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "RoundValidationError";
  }
}

export const roundValidator = new RoundValidator();
