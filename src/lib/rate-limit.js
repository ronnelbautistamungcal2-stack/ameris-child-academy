/**
 * Simple in-memory rate limiter.
 *
 * Usage:
 *   import { rateLimit } from "@/lib/rate-limit";
 *   const limiter = rateLimit({ interval: 60_000, limit: 10 });
 *
 *   export default async function handler(req, res) {
 *     const { isLimited } = limiter.check(req);
 *     if (isLimited) return res.status(429).json({ error: "Too many requests" });
 *     // ... handle request
 *   }
 */
export function rateLimit({ interval = 60_000, limit = 10, getKey } = {}) {
  const tokenBuckets = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of tokenBuckets) {
      if (now - bucket.lastReset > interval * 2) {
        tokenBuckets.delete(key);
      }
    }
  }, interval);

  if (cleanup.unref) cleanup.unref();

  function getIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    return (
      (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : null) ||
      req.socket?.remoteAddress ||
      "unknown"
    );
  }

  function defaultKey(req) {
    return getIp(req);
  }

  function check(req) {
    const ip = getIp(req);
    const key = typeof getKey === "function" ? getKey(req) || defaultKey(req) : defaultKey(req);

    const now = Date.now();
    let bucket = tokenBuckets.get(key);

    if (!bucket || now - bucket.lastReset > interval) {
      bucket = { count: 0, lastReset: now };
      tokenBuckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, limit - bucket.count);
    const isLimited = bucket.count > limit;

    return { isLimited, remaining, key, ip };
  }

  return { check };
}
