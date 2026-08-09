import "server-only";
import { withRetry } from "./retry";
import { withCircuitBreaker } from "./circuit-breaker";

type CallOptions = {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
};

// Every external API call in the generation pipeline should go through this:
// circuit breaker first (fail fast if the service is already down), then
// retry with backoff underneath it.
export async function callExternalApi<T>(
  service: string,
  fn: () => Promise<T>,
  opts?: CallOptions
): Promise<T> {
  return withCircuitBreaker(service, () => withRetry(fn, opts));
}
