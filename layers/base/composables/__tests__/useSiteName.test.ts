/**
 * Tests for useSiteName — the SEO brand resolver.
 *
 * The server-side branch (import.meta.server + event.context.cpubSiteName, set by
 * the site-identity-prime Nitro plugin) is a build-time-replaced conditional that
 * vitest can't exercise (import.meta.server is undefined here); it's verified via
 * the live SSR head instead. These cases cover the client/fallback path + the
 * useState memoization + the graceful 'CommonPub' fallback when Nuxt is absent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, type Ref } from 'vue';
import { useSiteName } from '../useSiteName';

// useState is a globally-keyed singleton in Nuxt; give each test a fresh store.
let stateStore: Map<string, Ref<unknown>>;
const useStateMock = vi.fn(<T>(key: string, init: () => T) => {
  if (!stateStore.has(key)) stateStore.set(key, ref(init()) as Ref<unknown>);
  return stateStore.get(key) as Ref<T>;
});

let publicConfig: Record<string, unknown>;
const useRuntimeConfigMock = vi.fn(() => ({ public: publicConfig }));

beforeEach(() => {
  stateStore = new Map();
  publicConfig = { siteName: 'devEco.io' };
  vi.stubGlobal('useState', useStateMock);
  vi.stubGlobal('useRuntimeConfig', useRuntimeConfigMock);
  // useRequestEvent exists as an auto-import; on the (client-like) test path the
  // import.meta.server guard skips it, but stub it so the `typeof` check is safe.
  vi.stubGlobal('useRequestEvent', () => null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useSiteName', () => {
  it('returns the runtime-config site name (the per-instance brand)', () => {
    expect(useSiteName()).toBe('devEco.io');
  });

  it('falls back to CommonPub when no site name is configured', () => {
    publicConfig = {};
    expect(useSiteName()).toBe('CommonPub');
  });

  it('falls back to CommonPub when an empty string is configured', () => {
    publicConfig = { siteName: '' };
    expect(useSiteName()).toBe('CommonPub');
  });

  it('memoizes via useState (resolves the brand once per key)', () => {
    expect(useSiteName()).toBe('devEco.io');
    // A later config change does not re-resolve within the same state scope.
    publicConfig = { siteName: 'Changed' };
    expect(useSiteName()).toBe('devEco.io');
    // useState was consulted, and the initializer ran exactly once for the key.
    const initCalls = useStateMock.mock.calls.filter(([k]) => k === 'cpub-site-name');
    expect(initCalls.length).toBeGreaterThanOrEqual(2);
    expect(stateStore.size).toBe(1);
  });

  it('returns CommonPub (never throws) when the Nuxt instance is unavailable', () => {
    vi.stubGlobal('useState', () => { throw new Error('no nuxt instance'); });
    expect(useSiteName()).toBe('CommonPub');
  });
});
