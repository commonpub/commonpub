/**
 * Env-gated factory for realtime pub/sub.
 *
 * Selects Redis when `NUXT_REDIS_URL` is set AND `ioredis` is installed;
 * falls back to in-process `MemoryRealtimePubSub` otherwise. Same contract
 * as the rate-limit store factory — no top-level await, the Redis backend
 * initializes lazily on first `publish`/`subscribe`.
 */
import { MemoryRealtimePubSub, type RealtimePubSub } from './pubsub.js';
import { RedisRealtimePubSub } from './redisPubsub.js';
import { createRedisClient } from '../redis/client.js';

export interface CreateRealtimePubSubOptions {
  redisUrl?: string | undefined;
}

export function createRealtimePubSub(options: CreateRealtimePubSubOptions = {}): RealtimePubSub {
  const url = options.redisUrl?.trim();
  if (!url) return new MemoryRealtimePubSub();
  return new LazyRedisRealtimePubSub(url);
}

class LazyRedisRealtimePubSub implements RealtimePubSub {
  private resolved: Promise<RealtimePubSub> | null = null;
  private readonly fallback = new MemoryRealtimePubSub();

  constructor(private readonly url: string) {}

  async publish(channel: string, payload: unknown): Promise<void> {
    const pubsub = await this.resolve();
    await pubsub.publish(channel, payload);
  }

  async subscribe(channel: string, handler: (payload: unknown) => void): Promise<() => void> {
    const pubsub = await this.resolve();
    return pubsub.subscribe(channel, handler);
  }

  async close(): Promise<void> {
    await this.fallback.close();
    if (this.resolved) {
      const pubsub = await this.resolved;
      if (pubsub !== this.fallback) await pubsub.close();
    }
  }

  private async resolve(): Promise<RealtimePubSub> {
    if (!this.resolved) {
      this.resolved = this.build();
    }
    return this.resolved;
  }

  private async build(): Promise<RealtimePubSub> {
    try {
      const publisher = await createRedisClient({ url: this.url });
      if (!publisher) return this.fallback;
      // Dedicated subscriber — ioredis's `duplicate()` clones the config
      // (URL, TLS, password) but opens a separate socket. Subscribe-mode
      // restrictions then apply only to this one.
      const subscriber = publisher.duplicate();
      subscriber.on('error', () => {});
      return new RedisRealtimePubSub(publisher, subscriber);
    } catch {
      return this.fallback;
    }
  }
}
