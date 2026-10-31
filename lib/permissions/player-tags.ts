/** Max length for in-game chat prefix and scoreboard clan. */
export const PLAYER_TAG_MAX_LENGTH = 16;

const PLAYER_TAG_PATTERN = /^[\p{L}\p{N} \[\]\-_./+]+$/u;

/**
 * Normalize an admin-entered chat or scoreboard tag.
 * Empty / whitespace → null (use the role default in-game).
 */
export function parsePlayerTag(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error("Tag must be a string.");
  }

  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;

  if ([...collapsed].length > PLAYER_TAG_MAX_LENGTH) {
    throw new Error(
      `Tag must be ${PLAYER_TAG_MAX_LENGTH} characters or fewer.`,
    );
  }

  if ([...collapsed].some((ch) => ch.charCodeAt(0) < 32)) {
    throw new Error("Tag cannot include control characters.");
  }

  if (!PLAYER_TAG_PATTERN.test(collapsed)) {
    throw new Error(
      "Tag may only include letters, numbers, spaces, and [] - _ . / +",
    );
  }

  return collapsed;
}
