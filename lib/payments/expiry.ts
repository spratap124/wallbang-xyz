const MS_PER_DAY = 86_400_000;

export function durationDaysToMs(durationDays: number): number {
  return durationDays * MS_PER_DAY;
}

/**
 * If VIP is still active, stack the new term onto the existing expiry.
 * If expired or never VIP, start from `now`.
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
