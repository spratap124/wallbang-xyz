/** WallBang stats & admin timestamps always use India Standard Time. */
export const IST_TIME_ZONE = "Asia/Kolkata";
/** Fixed offset — Asia/Kolkata has no DST. */
export const IST_UTC_OFFSET = "+05:30";
export const IST_LOCALE = "en-IN";

/** YYYY-MM-DD calendar key in IST for an instant. */
export function istDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Inclusive start / exclusive end of a YYYY-MM-DD calendar day in IST. */
export function istDayBounds(dayKey: string): { start: Date; end: Date } {
  const start = new Date(`${dayKey}T00:00:00.000${IST_UTC_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function listRecentIstDayKeys(
  dayCount: number,
  now: Date = new Date(),
): string[] {
  const todayKey = istDayKey(now);
  const { start: todayStart } = istDayBounds(todayKey);
  const keys: string[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const instant = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
    keys.push(istDayKey(instant));
  }
  return keys;
}
