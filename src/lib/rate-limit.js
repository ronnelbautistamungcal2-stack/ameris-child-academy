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
export function rateLimit({ interval = 60_000, limit = 10 } = {}) {
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

  function check(req) {
    const forwarded = req.headers["x-forwarded-for"];
    const ip =
      (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : null) ||
      req.socket?.remoteAddress ||
      "unknown";

    const now = Date.now();
    let bucket = tokenBuckets.get(ip);

    if (!bucket || now - bucket.lastReset > interval) {
      bucket = { count: 0, lastReset: now };
      tokenBuckets.set(ip, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, limit - bucket.count);
    const isLimited = bucket.count > limit;

    return { isLimited, remaining, ip };
  }

  return { check };
}
