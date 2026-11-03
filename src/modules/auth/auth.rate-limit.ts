
import { createHash } from "node:crypto";

interface RateLimitBucket {
  windowStartedAt: number;
  count: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_IDENTIFIER_REQUESTS = 3;
const MAX_IP_REQUESTS = 10;
const MAX_BUCKETS = 10_000;

const buckets = new Map<string, RateLimitBucket>();

function createBucketKey(scope: string, value: string): string {
  const hash = createHash("sha256")
    .update(`${scope}:${value}`)
    .digest("hex");

  return `${scope}:${hash}`;
}

function removeExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt >= WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

function getBucket(
  key: string,
  now: number,
): RateLimitBucket {
  const existing = buckets.get(key);

  if (existing && now - existing.windowStartedAt < WINDOW_MS) {
    return existing;
  }

  const bucket: RateLimitBucket = {
    windowStartedAt: now,
    count: 0,
  };

  if (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;

    if (oldestKey) {
      buckets.delete(oldestKey);
    }
  }

  buckets.set(key, bucket);

  return bucket;
}

/**
 * Limits OTP requests:
 *
 * - 3 requests per normalized identifier / 15 minutes.
 * - 10 requests per identifiable IP / 15 minutes.
 *
 * IP throttling is skipped when the application cannot identify
 * the client IP reliably.
 *
 * This implementation is process-local. It resets on restart and
 * is not shared across multiple application instances.
 */
export function consumeOtpRequestLimit(
  identifier: string,
  clientIp: string | null,
): RateLimitResult {
  const now = Date.now();

  removeExpiredBuckets(now);

  const checks = [
    {
      key: createBucketKey("identifier", identifier),
      maximum: MAX_IDENTIFIER_REQUESTS,
    },
  ];

  if (clientIp) {
    checks.push({
      key: createBucketKey("ip", clientIp),
      maximum: MAX_IP_REQUESTS,
    });
  }

  const currentBuckets = checks.map(({ key, maximum }) => ({
    bucket: getBucket(key, now),
    maximum,
  }));

  // Check all buckets before incrementing any of them.
  for (const { bucket, maximum } of currentBuckets) {
    if (bucket.count >= maximum) {
      const remainingMs =
        WINDOW_MS - (now - bucket.windowStartedAt);

      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(remainingMs / 1000),
        ),
      };
    }
  }

  // Consume one request from each applicable bucket.
  for (const { bucket } of currentBuckets) {
    bucket.count += 1;
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}
