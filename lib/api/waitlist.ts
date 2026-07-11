import type { WaitlistInput } from "@/lib/validations/waitlist";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Abstraction boundary for waitlist submissions.
 * Swap the mock implementation for a real backend without touching UI forms.
 */
export async function submitWaitlist(
  input: WaitlistInput,
): Promise<ApiResult<{ id: string }>> {
  const response = await fetch("/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as ApiResult<{ id: string }>;

  if (!response.ok) {
    return {
      ok: false,
      error: "error" in payload ? payload.error : "Unable to join the waitlist.",
      fieldErrors: "fieldErrors" in payload ? payload.fieldErrors : undefined,
    };
  }

  return payload;
}
