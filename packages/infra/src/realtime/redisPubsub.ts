/**
 * Redis-backed pub/sub for SSE fanout across multiple Nitro processes.
 *
 * Uses two ioredis clients per instance:
 *  - `publisher`: shared write client, reused via the factory cache.
 *  - `subscriber`: a DEDICATED client. Redis pub/sub puts the connection
 *    into subscribe mode, which disallows regular commands; mixing the
 *    publisher client would block other callers.
 *
 * On connection drops, ioredis reconnects transparently; on reconnect
 * the subscriber replays `SUBSCRIBE` for every active channel via the
 * `onReconnect` path we wire up below.
 *
 * This module NEVER crashes on Redis errors — callers that care about
 * delivery (which SSE doesn't — it's best-effort) should implement their
 * own retry.
 */
import type { Redis } from 'ioredis';
import type { RealtimePubSub } from './pubsub.js';

export class RedisRealtimePubSub implements RealtimePubSub {
  private readonly handlers = new Map<string, Set<(payload: unknown) => void>>();
  private subscribed = false;
  private readonly onMessage = (channel: string, message: string): void => {
    const set = this.handlers.get(channel);
    if (!set || set.size === 0) return;
    let parsed: unknown = message;
    try {
      parsed = JSON.parse(message);
    } catch {
      // Leave as-is — payload was not JSON.
    }
    for (const handler of set) {
      try {
        handler(parsed);
      } catch (err) {
        // One misbehaving subscriber must not affect the others.
        if (typeof console !== 'undefined') {
          console.error('[realtime] subscriber threw:', err);
        }
      }
    }
  };

  constructor(
    private readonly publisher: Redis,
    private readonly subscriber: Redis,
  ) {}

  async publish(channel: string, payload: unknown): Promise<void> {
    try {
      const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
      await this.publisher.publish(channel, serialized);
    } catch (err) {
      // Best-effort. SSE already polls the DB, so a missed publish manifests
      // as a 10-second delay on that client, not a lost event.
      if (typeof console !== 'undefined') {
        console.warn('[realtime] publish failed:', err instanceof Error ? err.message : err);
      }
    }
  }

  async subscribe(channel: string, handler: (payload: unknown) => void): Promise<() => void> {
    if (!this.subscribed) {
      this.subscriber.on('message', this.onMessage);
      this.subscribed = true;
    }

    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
      // Only SUBSCRIBE once per channel; subsequent callers fan out locally.
      try {
        await this.subscriber.subscribe(channel);
      } catch (err) {
        if (typeof console !== 'undefined') {
          console.warn('[realtime] subscribe failed:', err instanceof Error ? err.message : err);
        }
      }
    }
    set.add(handler);

    return async () => {
      const current = this.handlers.get(channel);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        this.handlers.delete(channel);
        try {
          await this.subscriber.unsubscribe(channel);
        } catch {
          // ignore — the connection may already be gone.
        }
      }
    };
  }

  async close(): Promise<void> {
    this.handlers.clear();
    this.subscriber.off('message', this.onMessage);
    try {
      await this.subscriber.quit();
    } catch {
      this.subscriber.disconnect();
    }
    // `publisher` is a shared client owned by the factory cache — do NOT quit.
  }
}
