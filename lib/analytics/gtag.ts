import type { GaEcommerceItem } from "@/types/analytics";

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** True when the Google tag is configured for this build. */
export function isGaWebConfigured(): boolean {
  return MEASUREMENT_ID.length > 0;
}

export function gaMeasurementId(): string {
  return MEASUREMENT_ID;
}

/**
 * Reads the GA4 client id from the `_ga` cookie
 * (`GA1.<container>.<random>.<timestamp>` → `<random>.<timestamp>`).
 * Used as attribution context so the server can send authoritat­ive
 * purchase/refund events through the Measurement Protocol.
 */
export function readGaClientId(): string | null {
  if (typeof document === "undefined" || !MEASUREMENT_ID) return null;
  // _ga = GA1.<container>.<random>.<timestamp> → client id "<random>.<timestamp>".
  const match = document.cookie.match(
    /(?:^|;\s*)_ga=GA1\.\d+\.([\d-]+)\.([\d-]+)/,
  );
  if (match) {
    return `${match[1]}.${match[2]}`;
  }
  // Fallback: last two segments of whatever is stored.
  const raw = document.cookie.match(/(?:^|;\s*)_ga=([^;]+)/);
  if (!raw) return null;
  const segments = decodeURIComponent(raw[1]).split(".");
  if (segments.length < 2) return null;
  return `${segments[segments.length - 2] ?? ""}.${
    segments[segments.length - 1] ?? ""
  }`;
}

/**
 * Reads the GA4 session id from the per-property `_ga_<id>` cookie.
 *
 * Google changed this cookie from the positional `GS1` layout to the
 * keyed `GS2` layout in May 2025 (`GS2.1.s<session>$o<number>$g<engaged>...`),
 * so parse both instead of relying on a fixed segment index.
 */
export function readGaSessionId(): string | null {
  if (typeof document === "undefined" || !MEASUREMENT_ID) return null;
  const cookieName = `_ga_${MEASUREMENT_ID.replace(/^G-/, "")}`;
  const raw = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`),
  );
  if (!raw?.[1]) return null;
  return parseGaSessionId(decodeURIComponent(raw[1]));
}

/** Extracts the numeric session id from a GA4 `_ga_<id>` cookie value. */
export function parseGaSessionId(raw: string): string | null {
  if (!raw) return null;
  let value = raw;
  if (value.includes("%")) {
    try {
      value = decodeURIComponent(value);
    } catch {
      // Keep the raw value; the numeric fallbacks below still apply.
    }
  }
  // GS2: GS2.1.s1694691723$o1$g0$t1694691723$j60$l0$h0
  const gs2 = value.match(/(?:^|[.$])s(\d+)(?:[.$]|$)/);
  if (gs2?.[1]) return gs2[1];
  // GS1: GS1.1.1694691723.1.0.1694691723.0.0.0
  const parts = value.split(".");
  if (parts[0] === "GS1" && /^\d+$/.test(parts[2] ?? "")) {
    return parts[2] ?? null;
  }
  // Defensive fallback for future format tweaks: epoch-sized numeric segment.
  for (const part of parts) {
    if (/^\d{9,}$/.test(part)) return part;
  }
  return null;
}

/** Fires a gtag event; no-op when GA is not configured or blocked. */
export function trackGaEvent(
  name: string,
  params: Record<string, unknown> = {},
): void {
  if (!isGaWebConfigured() || typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag("event", name, params);
    return;
  }
  // The tag may not have loaded yet (blocking, consent tool, ad blocker).
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event: name,
    ...params,
  });
}

/** GA4 ecommerce payload shared by funnel events. */
export function vipEcommerceParams(input: {
  value: number;
  items: GaEcommerceItem[];
}): Record<string, unknown> {
  return {
    currency: "INR",
    value: input.value,
    items: input.items,
  };
}
