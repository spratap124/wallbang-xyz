import type { GaEcommerceItem } from "@/types/analytics";

/**
 * Server-side GA4 Measurement Protocol sender.
 *
 * Purchase/refund are authoritative only after the payment webhook fulfills,
 * so they are sent from the server. Attribution to a browsing session works by
 * replaying the client id captured at checkout; analytics failures must never
 * block payment fulfillment, so every call is best-effort.
 */
import "server-only";

const MEASUREMENT_ID =
  process.env.GA4_MEASUREMENT_ID?.trim() ||
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ||
  "";
const API_SECRET = process.env.GA4_API_SECRET?.trim() ?? "";
const COLLECT_URL = "https://www.google-analytics.com/mp/collect";

export function isGaMeasurementProtocolConfigured(): boolean {
  return MEASUREMENT_ID.length > 0 && API_SECRET.length > 0;
}

type GaMpEventInput = {
  /** GA4 client id captured from the browser (`_ga` cookie). Required. */
  clientId: string;
  name: string;
  params?: Record<string, string | number | boolean | undefined | null>;
  /** MP expects the items array inside params. */
  items?: GaEcommerceItem[];
  /** Optional epoch microseconds for backdating the event. */
  timestampMicros?: number;
};

/** Best-effort send; resolves false when skipped or rejected. Never throws. */
export async function sendGaMeasurementProtocolEvent(
  input: GaMpEventInput,
): Promise<boolean> {
  if (!isGaMeasurementProtocolConfigured()) return false;

  const { timestampMicros, ...rest } = input;
  const event: {
    name: string;
    params: Record<string, unknown>;
  } = {
    name: rest.name,
    params: {
      // Keep hits visible in standard GA4 reports even without a session id.
      engagement_time_msec: 100,
      ...Object.fromEntries(
        Object.entries(rest.params ?? {}).filter(
          ([, value]) => value !== undefined && value !== null,
        ),
      ),
      ...(rest.items ? { items: rest.items } : {}),
    },
  };

  try {
    const response = await fetch(COLLECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(timestampMicros ? { timestamp_micros: timestampMicros } : {}),
        client_id: input.clientId,
        events: [event],
      }),
      // Analytics is supplemental; do not let a hang block fulfillment.
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.warn("[analytics] GA4 Measurement Protocol rejected event", {
        status: response.status,
        name: input.name,
      });
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[analytics] GA4 Measurement Protocol send failed", {
      name: input.name,
      err: err instanceof Error ? err.message : err,
    });
    return false;
  }
}
