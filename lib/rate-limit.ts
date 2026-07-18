/**
 * Best-effort in-memory fixed-window rate limiter.
 *
 * Serverless instances don't share memory, so this caps bursts per warm
 * container rather than globally — enough to stop a single client hammering a
 * function. The Mongo snapshot already shields the game server from bursts;
 * this just protects the API surface. Swap for a shared store (Upstash/Redis)
 * if you need cross-instance guarantees.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, limit, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  return {
    ok: existing.count <= limit,
    limit,
    remaining,
    resetAt: existing.resetAt,
  };
}

/** Occasionally drop expired buckets so the map doesn't grow unbounded. */
export function sweepRateLimitBuckets(): void {
  if (buckets.size < 512) return;
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
