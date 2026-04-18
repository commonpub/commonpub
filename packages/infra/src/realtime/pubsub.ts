/**
 * Realtime pub/sub abstraction for SSE fanout.
 *
 * The SSE `/api/realtime/stream` endpoint holds one long-lived connection
 * per signed-in browser tab. Historically it polled the DB every 10 s in
 * whatever Nitro process the connection landed on. Under horizontal scaling
 * that breaks down: a notification written by process A doesn't wake a
 * stream on process B until B's next poll tick.
 *
 * This module provides a minimal contract the Nitro SSE handler can
 * subscribe to once per process and publishers can fire-and-forget to,
 * independent of how many processes exist. Two backends:
 *
 *  - `MemoryRealtimePubSub` — in-process `EventEmitter`. Same behavior as
 *    a single Nitro process today, which is fine for single-instance
 *    deploys.
 *  - `RedisRealtimePubSub` (in `./redisPubsub.ts`) — Redis pub/sub. One
 *    subscriber connection per process; publishers use the shared client.
 *
 * Payloads are JSON-serializable objects; callers pick the shape. The
 * channel is a string namespaced by the caller — typical form
 * `cpub:sse:user:<userId>`.
 */
import { EventEmitter } from 'node:events';

export interface RealtimePubSub {
  publish(channel: string, payload: unknown): Promise<void>;
  /** Returns an unsubscribe function. */
  subscribe(channel: string, handler: (payload: unknown) => void): Promise<() => void>;
  close(): Promise<void>;
}

/**
 * In-process pub/sub. Usable from tests and single-instance deploys. Two
 * `MemoryRealtimePubSub` instances do NOT share messages — they're
 * isolated per instance, which is the expected "memory mode" behavior.
 */
export class MemoryRealtimePubSub implements RealtimePubSub {
  private readonly bus = new EventEmitter();

  constructor() {
    // Avoid Node's 11-listener warning; each SSE connection adds one
    // listener per channel it cares about.
    this.bus.setMaxListeners(0);
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    this.bus.emit(channel, payload);
  }

  async subscribe(channel: string, handler: (payload: unknown) => void): Promise<() => void> {
    this.bus.on(channel, handler);
    return () => {
      this.bus.off(channel, handler);
    };
  }

  async close(): Promise<void> {
    this.bus.removeAllListeners();
  }
}
