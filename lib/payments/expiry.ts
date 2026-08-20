const MS_PER_DAY = 86_400_000;

export function durationDaysToMs(durationDays: number): number {
  return durationDays * MS_PER_DAY;
}

/**
 * Stack a purchased term onto one entitlement's current expiry.
 * - Active remaining time → end = remaining end + duration (e.g. 20d left + 180d)
 * - Expired / none → end = now + duration
 */
export function computeVipExtension(input: {
  currentExpiresAt: Date | null | undefined;
  now: Date;
  durationDays: number;
}): { startDate: Date; endDate: Date } {
  const current = input.currentExpiresAt;
  const active = Boolean(current && current.getTime() > input.now.getTime());
  const startDate = active && current ? current : input.now;
  return {
    startDate,
    endDate: new Date(
      startDate.getTime() + durationDaysToMs(input.durationDays),
    ),
  };
}
