import { describe, it, expect } from 'vitest';
import { MemoryRealtimePubSub, createRealtimePubSub } from '../index.js';

/**
 * Unit tests for realtime pub/sub. Memory-backend only; the Redis-backed
 * implementation is exercised by the redis integration test when enabled.
 */

describe('MemoryRealtimePubSub', () => {
  it('fans a publish to every subscriber on the channel', async () => {
    const bus = new MemoryRealtimePubSub();
    const a: unknown[] = [];
    const b: unknown[] = [];
    await bus.subscribe('cpub:sse:user:u1', (p) => a.push(p));
    await bus.subscribe('cpub:sse:user:u1', (p) => b.push(p));
    await bus.publish('cpub:sse:user:u1', { type: 'notification' });
    expect(a).toEqual([{ type: 'notification' }]);
    expect(b).toEqual([{ type: 'notification' }]);
    await bus.close();
  });

  it('does not deliver to subscribers on other channels', async () => {
    const bus = new MemoryRealtimePubSub();
    const received: unknown[] = [];
    await bus.subscribe('cpub:sse:user:u1', (p) => received.push(p));
    await bus.publish('cpub:sse:user:u2', { type: 'notification' });
    expect(received).toEqual([]);
    await bus.close();
  });

  it('unsubscribe stops delivery without affecting other subscribers', async () => {
    const bus = new MemoryRealtimePubSub();
    const a: unknown[] = [];
    const b: unknown[] = [];
    const unA = await bus.subscribe('chan', (p) => a.push(p));
    await bus.subscribe('chan', (p) => b.push(p));
    await bus.publish('chan', 1);
    unA();
    await bus.publish('chan', 2);
    expect(a).toEqual([1]);
    expect(b).toEqual([1, 2]);
    await bus.close();
  });
});

describe('createRealtimePubSub (factory)', () => {
  it('returns in-process bus when redisUrl is unset', async () => {
    const bus = createRealtimePubSub();
    const received: unknown[] = [];
    await bus.subscribe('c', (p) => received.push(p));
    await bus.publish('c', 'hello');
    expect(received).toEqual(['hello']);
    await bus.close();
  });

  it('returns in-process bus when redisUrl is only whitespace', async () => {
    const bus = createRealtimePubSub({ redisUrl: '  ' });
    const received: unknown[] = [];
    await bus.subscribe('c', (p) => received.push(p));
    await bus.publish('c', 'hello');
    expect(received).toEqual(['hello']);
    await bus.close();
  });
});
