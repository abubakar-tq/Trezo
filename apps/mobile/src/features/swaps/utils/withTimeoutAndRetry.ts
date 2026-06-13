// apps/mobile/src/features/swaps/utils/withTimeoutAndRetry.ts
export interface TimeoutAndRetryOptions {
  timeoutMs: number;
  retries?: number; // default 1 -> total 2 attempts
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const isRetryable = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("fetch failed") ||
    msg.includes("econn") ||
    msg.includes("eai_again") ||
    msg.includes("etimedout")
  );
};

export const withTimeoutAndRetry = async <T>(
  fn: () => Promise<T>,
  opts: TimeoutAndRetryOptions,
): Promise<T> => {
  const total = (opts.retries ?? 1) + 1;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= total; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), opts.timeoutMs),
        ),
      ]);
    } catch (err) {
      lastErr = err;
      if (attempt >= total) break;
      if (!isRetryable(err)) break;
      await sleep(150 * attempt);
    }
  }
  throw lastErr ?? new Error("withTimeoutAndRetry exhausted");
};
