import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRedisFailOpenLogger } from '../index.js';

describe('createRedisFailOpenLogger', () => {
  const hooks: Array<ReturnType<typeof createRedisFailOpenLogger>> = [];

  afterEach(() => {
    while (hooks.length) hooks.shift()?.stop();
    vi.useRealTimers();
  });

  it('logs the first fail-open immediately, coalesces subsequent events', () => {
    vi.useFakeTimers();
    const sink = vi.fn();
    const hook = createRedisFailOpenLogger({ windowMs: 1_000, sink, scope: 'test' });
    hooks.push(hook);

    const err = new Error('ECONNREFUSED');
    hook(err, { operation: 'exec', key: 'cpub:ratelimit:ip:foo' });
    hook(err, { operation: 'exec', key: 'cpub:ratelimit:ip:foo' });
    hook(err, { operation: 'exec', key: 'cpub:ratelimit:ip:bar' });

    // First call should have logged immediately.
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0]?.[0]).toContain('[test]');
    expect(sink.mock.calls[0]?.[0]).toContain('Redis fail-open');
    expect(sink.mock.calls[0]?.[0]).toContain('ECONNREFUSED');

    // Roll up: fast-forward one window, expect the rollup line.
    vi.advanceTimersByTime(1_000);
    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink.mock.calls[1]?.[0]).toContain('rollup');
    expect(sink.mock.calls[1]?.[0]).toContain('2 additional events');
    expect(sink.mock.calls[1]?.[1]).toMatchObject({ operations: { exec: 3 } });
  });

  it('no rollup line when only a single event fired in the window', () => {
    vi.useFakeTimers();
    const sink = vi.fn();
    const hook = createRedisFailOpenLogger({ windowMs: 500, sink });
    hooks.push(hook);

    hook(new Error('boom'), { operation: 'init', key: 'cpub:ratelimit:ip' });
    expect(sink).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);
    // Only the immediate log — no rollup because total === 1.
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('new window re-arms the "first event" behavior', () => {
    vi.useFakeTimers();
    const sink = vi.fn();
    const hook = createRedisFailOpenLogger({ windowMs: 500, sink });
    hooks.push(hook);

    hook(new Error('a'), { operation: 'exec', key: 'k1' });
    vi.advanceTimersByTime(500);
    expect(sink).toHaveBeenCalledTimes(1); // only the immediate log

    hook(new Error('b'), { operation: 'exec', key: 'k2' });
    // Second window's first event logs immediately again.
    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink.mock.calls[1]?.[0]).toContain('Redis fail-open');
  });

  it('snapshot reflects current window counts', () => {
    vi.useFakeTimers();
    const hook = createRedisFailOpenLogger({ windowMs: 10_000, sink: () => {} });
    hooks.push(hook);

    hook(new Error('x'), { operation: 'exec', key: 'k1' });
    hook(new Error('x'), { operation: 'init', key: 'k2' });
    hook(new Error('x'), { operation: 'exec', key: 'k3' });

    const snap = hook.snapshot();
    expect(snap.total).toBe(3);
    expect(snap.operations).toEqual({ exec: 2, init: 1 });
    expect(snap.lastError).toBe('x');
  });
});
