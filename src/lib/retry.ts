import "server-only";

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
};

// R3: timeout + retry with exponential backoff on every external call.
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, baseDelayMs = 300, timeoutMs = 10_000 }: RetryOptions = {}
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}
