import { describe, it, expect } from 'vitest';
import { createStructuredLogger } from '../structuredLogger.js';

describe('createStructuredLogger', () => {
  it('emits one JSON line per event with ts/level/component/message', () => {
    const out: string[] = [];
    const sink = createStructuredLogger({ component: 'test', write: (l) => out.push(l) });

    sink('hello');

    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0]!);
    expect(parsed).toMatchObject({ level: 'warn', component: 'test', message: 'hello' });
    expect(typeof parsed.ts).toBe('string');
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(out[0]).toMatch(/\n$/);
  });

  it('spreads meta fields alongside top-level keys', () => {
    const out: string[] = [];
    const sink = createStructuredLogger({ component: 'ratelimit-ip', write: (l) => out.push(l) });

    sink('Redis fail-open', { key: 'cpub:ratelimit:ip:/:1', operation: 'exec' });

    const parsed = JSON.parse(out[0]!);
    expect(parsed.key).toBe('cpub:ratelimit:ip:/:1');
    expect(parsed.operation).toBe('exec');
    expect(parsed.component).toBe('ratelimit-ip');
  });

  it('prevents meta from shadowing reserved top-level keys', () => {
    const out: string[] = [];
    const sink = createStructuredLogger({ component: 'svc', write: (l) => out.push(l) });

    sink('boom', {
      ts: 'EVIL', level: 'debug', component: 'other', message: 'override',
      keep: 'me',
    });

    const parsed = JSON.parse(out[0]!);
    expect(parsed.ts).not.toBe('EVIL');
    expect(parsed.level).toBe('warn');
    expect(parsed.component).toBe('svc');
    expect(parsed.message).toBe('boom');
    expect(parsed.keep).toBe('me');
  });

  it('honours custom level', () => {
    const out: string[] = [];
    const sink = createStructuredLogger({ component: 'svc', level: 'error', write: (l) => out.push(l) });
    sink('bad');
    expect(JSON.parse(out[0]!).level).toBe('error');
  });

  it('falls back to console.warn when meta has a circular ref', () => {
    const out: string[] = [];
    const sink = createStructuredLogger({ component: 'svc', write: (l) => out.push(l) });
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    // Should not throw
    expect(() => sink('cycle', circular)).not.toThrow();
    // write should NOT have been called — JSON.stringify threw before it.
    expect(out).toHaveLength(0);
  });
});
