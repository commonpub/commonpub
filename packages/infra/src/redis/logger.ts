/**
 * Rate-limited fail-open logger for the Redis stores.
 *
 * A Redis outage produces one fail-open event per request, which would
 * flood the log at real traffic. This helper coalesces into:
 *   - The FIRST event is logged immediately with a warning banner so
 *     operators see the outage start in near-real time.
 *   - Subsequent events within a window are counted silently.
 *   - At the end of each window a rollup line is logged: how many
 *     fail-opens happened and which operations were involved.
 *
 * Default window 60 s. Pass `console.warn` (or a structured logger) as
 * the sink — anything with `(msg, meta?) => void` works.
 */

export interface FailOpenLoggerOptions {
  /** How often to roll up counts. Defaults to 60 s. */
  windowMs?: number;
  /** Where to emit. Defaults to console.warn. */
  sink?: (message: string, meta?: Record<string, unknown>) => void;
  /**
   * Human-friendly scope label, e.g. "ratelimit:ip" or
   * "ratelimit:apikey". Prefixed to every log line so mixed streams stay
   * readable.
   */
  scope?: string;
}

export interface FailOpenSummary {
  total: number;
  windowStart: number;
  operations: Record<string, number>;
  lastError?: string;
}

export interface FailOpenHook {
  (error: unknown, context: { operation: string; key: string }): void;
  /** Inspect the current rollup — useful in tests or a metric endpoint. */
  snapshot(): FailOpenSummary;
  /** Stop the timer. Idempotent. */
  stop(): void;
}

export function createRedisFailOpenLogger(options: FailOpenLoggerOptions = {}): FailOpenHook {
  const windowMs = options.windowMs ?? 60_000;
  const sink = options.sink ?? ((msg, meta) => {
    if (typeof console === 'undefined') return;
    if (meta) console.warn(msg, meta);
    else console.warn(msg);
  });
  const scope = options.scope ? `[${options.scope}] ` : '';

  let seenInWindow = 0;
  let firstInWindow = true;
  let windowStart = Date.now();
  const operations: Record<string, number> = {};
  let lastError: string | undefined;

  function flushRollup(): void {
    if (seenInWindow <= 1) {
      // Already reported the first occurrence; if that was the only one
      // in this window, no rollup needed.
      reset();
      return;
    }
    const total = seenInWindow;
    const extras = total - 1; // we already logged the first one inline
    sink(`${scope}Redis fail-open rollup: ${extras} additional events in last ${Math.round((Date.now() - windowStart) / 1000)}s`, {
      operations: { ...operations },
      lastError,
    });
    reset();
  }

  function reset(): void {
    seenInWindow = 0;
    firstInWindow = true;
    windowStart = Date.now();
    for (const k of Object.keys(operations)) delete operations[k];
    lastError = undefined;
  }

  const timer = setInterval(flushRollup, windowMs);
  // Node: don't keep the process alive just for this timer.
  if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
    (timer as { unref?: () => void }).unref?.();
  }

  const hook: FailOpenHook = Object.assign(
    (error: unknown, context: { operation: string; key: string }) => {
      seenInWindow += 1;
      operations[context.operation] = (operations[context.operation] ?? 0) + 1;
      lastError = error instanceof Error ? error.message : String(error);

      if (firstInWindow) {
        firstInWindow = false;
        sink(`${scope}Redis fail-open: ${context.operation} failed (${lastError}). Falling back to in-memory behavior; rate limits are now per-process until Redis recovers.`, {
          key: context.key,
        });
      }
    },
    {
      snapshot(): FailOpenSummary {
        return {
          total: seenInWindow,
          windowStart,
          operations: { ...operations },
          lastError,
        };
      },
      stop(): void {
        clearInterval(timer);
      },
    },
  );

  return hook;
}
