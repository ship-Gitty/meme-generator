import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// NFR-6: per-user rate limit on generation requests, so one user can't
// exhaust shared third-party API quotas. 5/minute is a starting point —
// tune against real usage rather than guessing (R2's philosophy applied here).
export const generateRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "ratelimit:generate",
});
