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
