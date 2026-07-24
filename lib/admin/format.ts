import { IST_LOCALE, IST_TIME_ZONE } from "@/lib/time/ist";

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 48) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

function asDate(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Always formats in IST (Asia/Kolkata). */
export function formatDateTime(value: string | Date): string {
  const d = asDate(value);
  if (!d) return "—";
  return d.toLocaleString(IST_LOCALE, {
    timeZone: IST_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Full IST datetime for audit / expiry style displays. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = asDate(value);
  if (!d) return "—";
  return d.toLocaleString(IST_LOCALE, {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/** Format a YYYY-MM-DD IST calendar day key (no timezone shift). */
export function formatDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const d = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(IST_LOCALE, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function mapThumbPath(map: string | null | undefined): string | null {
  if (!map) return null;
  const base = map.replace(/^workshop\//, "").split("/").pop() ?? map;
  const slug = base.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!slug.startsWith("de_")) return null;
  return `/maps/${slug}.png`;
}
