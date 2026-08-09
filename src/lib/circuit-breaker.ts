import "server-only";
import { redis } from "./redis";

// R3: if an API fails repeatedly, skip it gracefully rather than hanging the
// request. State lives in Redis (not memory) since serverless instances
// don't share memory across invocations.
const FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_SECONDS = 60;
const OPEN_COOLDOWN_SECONDS = 60;

export class CircuitOpenError extends Error {
  constructor(service: string) {
    super(`Circuit breaker open for "${service}" — too many recent failures.`);
    this.name = "CircuitOpenError";
  }
}

async function isOpen(service: string): Promise<boolean> {
  const open = await redis.get(`circuit:${service}:open`);
  return open !== null;
}

async function recordFailure(service: string): Promise<void> {
  const key = `circuit:${service}:failures`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, FAILURE_WINDOW_SECONDS);
  }
  if (count >= FAILURE_THRESHOLD) {
    await redis.set(`circuit:${service}:open`, "1", { ex: OPEN_COOLDOWN_SECONDS });
  }
}

async function recordSuccess(service: string): Promise<void> {
  await redis.del(`circuit:${service}:failures`);
}

export async function withCircuitBreaker<T>(service: string, fn: () => Promise<T>): Promise<T> {
  if (await isOpen(service)) {
    throw new CircuitOpenError(service);
  }
  try {
    const result = await fn();
    await recordSuccess(service);
    return result;
  } catch (err) {
    await recordFailure(service);
    throw err;
  }
}
