import { IST_LOCALE, IST_TIME_ZONE } from "@/lib/time/ist";

export function formatVipExpiryDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(IST_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: IST_TIME_ZONE,
  });
}

export function daysUntilExpiry(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export function formatDaysRemaining(value: string | Date | null | undefined): string | null {
  const days = daysUntilExpiry(value);
  if (days === null) return null;
  if (days === 0) return "Expires today";
  if (days === 1) return "1 day remaining";
  return `${days} days remaining`;
}
