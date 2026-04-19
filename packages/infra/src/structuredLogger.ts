/**
 * Structured JSON logger — observability-ready sink for events that would
 * otherwise go to `console.warn`. Emits one JSON line per event to stdout
 * (the Docker default log stream, captured by `docker logs` and by any
 * JSON-aware aggregator like Loki, Datadog, CloudWatch Logs, Splunk, etc.).
 *
 * No dependencies. No buffering. Failure here never propagates into request
 * paths: if `JSON.stringify` throws (circular meta), we fall back to the
 * original console.warn so the event is not lost.
 *
 * Designed to plug into `createRedisFailOpenLogger({ sink })` and similar
 * hooks that accept `(message: string, meta?: Record<string, unknown>) => void`.
 *
 * Example output:
 *   {"ts":"2026-04-19T22:00:01.234Z","level":"warn","component":"ratelimit-ip",
 *    "message":"[ratelimit:ip] Redis fail-open: exec failed (ECONNREFUSED)...",
 *    "key":"cpub:ratelimit:ip:/:1776635700000"}
 */

export interface StructuredLoggerOptions {
  /**
   * Component name — makes it easy to filter log events by subsystem.
   * E.g. "ratelimit-ip", "ratelimit-apikey", "realtime-pubsub".
   */
  component: string;
  /** Severity. Defaults to "warn". */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /**
   * Where to write the JSON line. Defaults to `process.stdout.write`.
   * Override for tests.
   */
  write?: (line: string) => void;
}

export type StructuredSink = (message: string, meta?: Record<string, unknown>) => void;

export function createStructuredLogger(options: StructuredLoggerOptions): StructuredSink {
  const component = options.component;
  const level = options.level ?? 'warn';
  const write = options.write ?? ((line) => process.stdout.write(line));

  return (message: string, meta?: Record<string, unknown>) => {
    try {
      const event: Record<string, unknown> = {
        ts: new Date().toISOString(),
        level,
        component,
        message,
      };
      if (meta) {
        for (const [k, v] of Object.entries(meta)) {
          // Reserve the top-level keys so meta can't shadow them.
          if (k === 'ts' || k === 'level' || k === 'component' || k === 'message') continue;
          event[k] = v;
        }
      }
      write(JSON.stringify(event) + '\n');
    } catch (err) {
      // Fall back to console.warn so the event is at least observable.
      // Most likely cause: circular reference in meta.
      if (typeof console !== 'undefined') {
        console.warn(`[${component}] ${message}`, meta, '(structured log failed:', err, ')');
      }
    }
  };
}
