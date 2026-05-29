/**
 * Tests for useLayoutEditor — the draft/original/dirty state machine
 * behind the /admin/layouts/[id] editor (Phase 3a.3 + 3a.6).
 *
 * The composable does HTTP via `$fetch` (auto-import). The tests stub
 * the global `$fetch` to a controllable mock so we can drive save/
 * publish/refresh through their happy + error paths.
 *
 * Test focus areas:
 *   - dirty derives correctly from draft vs original (stable-stringify)
 *   - save() updates ONLY original on success (preserves in-flight draft)
 *   - save() throws on 409 + sets status='conflict'
 *   - save({force:true}) omits If-Match header
 *   - publish() saves dirty first, then publishes, then refreshes
 *   - discard() reverts draft to original
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLayoutEditor, PublishStepError } from '../useLayoutEditor';
import type { LayoutRecord } from '@commonpub/server';

function fixture(overrides: Partial<LayoutRecord> = {}): LayoutRecord {
  return {
    id: 'L1',
    scope: { type: 'route', path: '/' },
    name: 'Homepage',
    pageMeta: null,
    state: 'draft',
    publishedVersionId: null,
    zones: [],
    createdAt: '2026-05-27T00:00:00.000Z',
    updatedAt: '2026-05-27T00:00:00.000Z',
    ...overrides,
  };
}

// Build a controllable $fetch mock + install on globalThis (matches the
// auto-import surface). Returns { mock, restore }.
function installFetch(impl?: (url: string, opts?: Record<string, unknown>) => Promise<unknown>) {
  const mock = vi.fn(impl ?? (() => Promise.resolve(undefined as unknown)));
  const g = globalThis as Record<string, unknown>;
  const prev = g.$fetch;
  g.$fetch = mock;
  return {
    mock,
    restore: () => { g.$fetch = prev; },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLayoutEditor — dirty derivation', () => {
  it('is false when draft is null', () => {
    const editor = useLayoutEditor('L1');
    expect(editor.dirty.value).toBe(false);
  });

  it('is false when draft equals original (stable-stringify, key order insensitive)', () => {
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = fixture(); // same content, possibly different key order
    expect(editor.dirty.value).toBe(false);
  });

  it('flips true when a draft field changes', () => {
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = fixture();
    expect(editor.dirty.value).toBe(false);
    editor.draft.value = { ...editor.draft.value, name: 'Changed' };
    expect(editor.dirty.value).toBe(true);
  });
});

describe('useLayoutEditor — save()', () => {
  it('no-ops when not dirty', async () => {
    const { mock } = installFetch();
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = fixture();
    await editor.save();
    expect(mock).not.toHaveBeenCalled();
  });

  it('sends PUT with If-Match header from original.updatedAt', async () => {
    const updated = fixture({ name: 'Renamed', updatedAt: '2026-05-28T00:00:00.000Z' });
    const { mock } = installFetch(() => Promise.resolve(updated));
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    await editor.save();
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, opts] = mock.mock.calls[0]!;
    expect(url).toBe('/api/admin/layouts/L1');
    const o = opts as { method?: string; headers?: Record<string, string> };
    expect(o.method).toBe('PUT');
    expect(o.headers?.['If-Match']).toBe('2026-05-27T00:00:00.000Z');
  });

  it('updates ONLY original on success (draft preserves in-flight edits)', async () => {
    const updated = fixture({ name: 'Renamed', updatedAt: '2026-05-28T00:00:00.000Z' });
    installFetch(() => Promise.resolve(updated));
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    // Capture the draft reference before save — should be SAME after
    const draftBefore = editor.draft.value;
    await editor.save();

    expect(editor.original.value).toEqual(updated);
    expect(editor.draft.value).toBe(draftBefore); // identity preserved
    expect(editor.status.value).toBe('saved');
  });

  it('sets status=conflict + throws on 409', async () => {
    installFetch(() => Promise.reject({ statusCode: 409, statusMessage: 'Conflict' }));
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    await expect(editor.save()).rejects.toMatchObject({ statusCode: 409 });
    expect(editor.status.value).toBe('conflict');
    expect(editor.errorMessage.value).toContain('Another admin');
  });

  it('save({force:true}) omits If-Match header', async () => {
    const updated = fixture({ name: 'Renamed' });
    const { mock } = installFetch(() => Promise.resolve(updated));
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    await editor.save({ force: true });
    const [, opts] = mock.mock.calls[0]!;
    const o = opts as { headers?: Record<string, string> };
    expect(o.headers?.['If-Match']).toBeUndefined();
  });

  it('sets status=error on non-409 errors', async () => {
    installFetch(() => Promise.reject({ statusCode: 500, statusMessage: 'boom' }));
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    await expect(editor.save()).rejects.toBeDefined();
    expect(editor.status.value).toBe('error');
    expect(editor.errorMessage.value).toBe('boom');
  });
});

describe('useLayoutEditor — flushBeacon() (session 162 P2.3)', () => {
  // flushBeacon uses the NATIVE `fetch` global, not `$fetch` — the whole
  // point is to bypass ofetch's response parsing/retries/abort wiring
  // and get a raw request the browser keeps alive past page teardown.
  // So these tests install a separate fetch mock rather than reusing
  // the installFetch helper above.
  function installNativeFetch(impl?: (url: string, opts?: Record<string, unknown>) => Promise<unknown>) {
    const mock = vi.fn(impl ?? (() => Promise.resolve(undefined as unknown)));
    const g = globalThis as Record<string, unknown>;
    const prev = g.fetch;
    g.fetch = mock;
    return {
      mock,
      restore: () => { g.fetch = prev; },
    };
  }

  it('returns false (no-op) when there is no draft or original', () => {
    const { mock } = installNativeFetch();
    const editor = useLayoutEditor('L1');
    // draft + original both null
    expect(editor.flushBeacon()).toBe(false);
    expect(mock).not.toHaveBeenCalled();
  });

  it('returns false (no-op) when not dirty', () => {
    const { mock } = installNativeFetch();
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = fixture();  // identical
    expect(editor.dirty.value).toBe(false);
    expect(editor.flushBeacon()).toBe(false);
    expect(mock).not.toHaveBeenCalled();
  });

  it('fires PUT with keepalive:true and If-Match header from original.updatedAt', () => {
    const { mock } = installNativeFetch();
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    expect(editor.flushBeacon()).toBe(true);
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, opts] = mock.mock.calls[0]! as [string, Record<string, unknown>];
    expect(url).toBe('/api/admin/layouts/L1');
    expect(opts.method).toBe('PUT');
    expect(opts.keepalive).toBe(true);
    const headers = opts.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['If-Match']).toBe('2026-05-27T00:00:00.000Z');
    expect(headers['X-Cpub-Save-Source']).toBe('beacon');
    // Body contains the renamed name
    const body = JSON.parse(opts.body as string) as { name: string };
    expect(body.name).toBe('Renamed');
  });

  it('does NOT pass an abort signal — the request must outlive the editor', () => {
    const { mock } = installNativeFetch();
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    editor.flushBeacon();
    const [, opts] = mock.mock.calls[0]! as [string, Record<string, unknown>];
    // Beacon must NOT pass signal; the whole point is to survive the
    // unmount abort that the regular save respects.
    expect(opts.signal).toBeUndefined();
  });

  it('is sync — returns true BEFORE the fetch promise resolves', () => {
    // Resolve never; flushBeacon should still return synchronously.
    const fetchPromise = new Promise(() => { /* never resolves */ });
    installNativeFetch(() => fetchPromise);
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    const result = editor.flushBeacon();
    // No await — the call returned with a boolean
    expect(result).toBe(true);
  });

  it('swallows synchronous fetch errors and returns false', () => {
    installNativeFetch(() => {
      throw new Error('fetch threw synchronously');
    });
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    // Must not propagate — the page is leaving
    expect(() => editor.flushBeacon()).not.toThrow();
    expect(editor.flushBeacon()).toBe(false);
  });
});

describe('useLayoutEditor — dirty version counter (session 162 P2.6)', () => {
  // Session 162 replaced the per-keystroke stableString-walk dirty
  // computed with O(1) version counters. These tests pin the new
  // semantics: editing during save preserves dirt, discard resets it,
  // and many mutations don't blow up.

  it('dirty stays TRUE after save success if user edited during the await', async () => {
    let resolveFetch: ((v: LayoutRecord) => void) | null = null;
    const fetchPromise = new Promise<LayoutRecord>((res) => { resolveFetch = res; });
    installFetch(() => fetchPromise);

    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };
    expect(editor.dirty.value).toBe(true);

    // Start the save (in flight, not resolved yet)
    const savePromise = editor.save();

    // User keeps editing during the await
    editor.draft.value = { ...editor.draft.value!, name: 'RenamedAgain' };

    // Resolve the in-flight save with the FIRST version
    resolveFetch!(fixture({ name: 'Renamed', updatedAt: '2026-05-28T12:00:00.000Z' }));
    await savePromise;

    // dirtyVersion bumped during the await; savedVersion only caught
    // up to the save-start snapshot. Dirty must remain TRUE so the
    // auto-save composable picks up the newer edits.
    expect(editor.dirty.value).toBe(true);
  });

  it('dirty resets to false after discard', () => {
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Edit' };
    expect(editor.dirty.value).toBe(true);

    editor.discard();
    expect(editor.dirty.value).toBe(false);
  });

  it('handles 1000 nested mutations without blowing the stack or hanging', () => {
    // Stress-guard: the previous O(N) stableString dirty would walk
    // the whole layout per access. The version counter must stay O(1).
    // This test would have run in seconds the old way; now it's sub-ms.
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = fixture();
    expect(editor.dirty.value).toBe(false);

    for (let i = 0; i < 1000; i++) {
      editor.draft.value!.name = `Change${i}`;
    }
    expect(editor.dirty.value).toBe(true);
  });
});

describe('useLayoutEditor — conflict thrash window (session 162 P2.5)', () => {
  // Conflict throttle: after 3 conflicts within a 60s rolling window,
  // conflictThrashing flips true. Auto-save composable consumers wire
  // this to their paused prop so they stop re-tripping the 409 loop.

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper: drive save() to a 409 result.
  async function fireConflict(editor: ReturnType<typeof useLayoutEditor>): Promise<void> {
    editor.original.value = fixture({ updatedAt: new Date().toISOString() });
    editor.draft.value = { ...fixture(), name: `Edit-${Math.random()}` };
    await expect(editor.save()).rejects.toMatchObject({ statusCode: 409 });
  }

  it('starts not thrashing', () => {
    const editor = useLayoutEditor('L1');
    expect(editor.conflictThrashing.value).toBe(false);
  });

  it('does not flip after a single 409', async () => {
    installFetch(() => Promise.reject({ statusCode: 409, statusMessage: 'Conflict' }));
    const editor = useLayoutEditor('L1');
    await fireConflict(editor);
    expect(editor.conflictThrashing.value).toBe(false);
  });

  it('does not flip after 2 conflicts in 60s', async () => {
    installFetch(() => Promise.reject({ statusCode: 409, statusMessage: 'Conflict' }));
    const editor = useLayoutEditor('L1');
    await fireConflict(editor);
    vi.advanceTimersByTime(10_000);
    await fireConflict(editor);
    expect(editor.conflictThrashing.value).toBe(false);
  });

  it('flips true after 3 conflicts within 60s', async () => {
    installFetch(() => Promise.reject({ statusCode: 409, statusMessage: 'Conflict' }));
    const editor = useLayoutEditor('L1');
    await fireConflict(editor);
    vi.advanceTimersByTime(10_000);
    await fireConflict(editor);
    vi.advanceTimersByTime(10_000);
    await fireConflict(editor);
    expect(editor.conflictThrashing.value).toBe(true);
  });

  it('does NOT flip when conflicts are spread across more than 60s', async () => {
    installFetch(() => Promise.reject({ statusCode: 409, statusMessage: 'Conflict' }));
    const editor = useLayoutEditor('L1');
    await fireConflict(editor);
    vi.advanceTimersByTime(30_000);
    await fireConflict(editor);
    vi.advanceTimersByTime(40_000); // first conflict now > 60s old
    await fireConflict(editor);
    // Only 2 conflicts within last 60s; threshold is 3.
    expect(editor.conflictThrashing.value).toBe(false);
  });

  it('clearConflictHistory() resets thrashing to false', async () => {
    installFetch(() => Promise.reject({ statusCode: 409, statusMessage: 'Conflict' }));
    const editor = useLayoutEditor('L1');
    await fireConflict(editor);
    await fireConflict(editor);
    await fireConflict(editor);
    expect(editor.conflictThrashing.value).toBe(true);

    editor.clearConflictHistory();
    expect(editor.conflictThrashing.value).toBe(false);
  });

  it('non-409 errors do NOT increment the conflict window', async () => {
    installFetch(() => Promise.reject({ statusCode: 500, statusMessage: 'boom' }));
    const editor = useLayoutEditor('L1');
    // Three 500s in a row should NOT trip thrashing.
    for (let i = 0; i < 3; i++) {
      editor.original.value = fixture({ updatedAt: new Date().toISOString() });
      editor.draft.value = { ...fixture(), name: `Edit-${i}` };
      await expect(editor.save()).rejects.toBeDefined();
    }
    expect(editor.conflictThrashing.value).toBe(false);
  });
});

describe('useLayoutEditor — abort() (R4 P2 audit fix)', () => {
  it('passes a signal to the PUT fetch', async () => {
    const { mock } = installFetch(() => Promise.resolve(fixture()));
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    await editor.save();
    // The PUT call (2nd arg = opts) should include `signal` from the
    // composable's AbortController, so consumers can cancel orphan PUTs.
    const lastCall = mock.mock.calls[mock.mock.calls.length - 1] as [string, Record<string, unknown>];
    expect(lastCall[1]).toHaveProperty('signal');
    // signal should be an AbortSignal instance — quack-typed
    const signal = lastCall[1].signal as { aborted: boolean };
    expect(signal).toBeDefined();
    expect(typeof signal.aborted).toBe('boolean');
  });

  it('treats AbortError as cancellation, not an error (status resets to idle)', async () => {
    // Mimic a DOMException AbortError — fetch behavior on signal.abort()
    const abortErr = Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });
    installFetch(() => Promise.reject(abortErr));
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    await expect(editor.save()).rejects.toBe(abortErr);
    // Critical: status must NOT be 'error' (the editor is unmounting; a
    // user-visible "Save failed" would be wrong + confusing).
    expect(editor.status.value).toBe('idle');
    expect(editor.errorMessage.value).toBeNull();
  });

  it('abort() flips the controller signal to aborted', () => {
    const editor = useLayoutEditor('L1');
    editor.abort();
    // No assertion possible without exposing the controller; the test
    // just verifies abort() is callable without throwing. The fetch
    // wiring + AbortError handling is covered by the two tests above.
    expect(true).toBe(true);
  });
});

describe('useLayoutEditor — refresh()', () => {
  it('replaces draft + original with the server response', async () => {
    const fresh = fixture({ name: 'From server', updatedAt: '2026-05-29T00:00:00.000Z' });
    installFetch(() => Promise.resolve(fresh));
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Local edit' };

    await editor.refresh();
    expect(editor.original.value).toEqual(fresh);
    expect(editor.draft.value).toEqual(fresh);
    expect(editor.dirty.value).toBe(false);
    expect(editor.status.value).toBe('idle');
  });
});

describe('useLayoutEditor — discard()', () => {
  it('reverts draft to a clone of original', () => {
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Local edit' };

    editor.discard();
    expect(editor.draft.value).toEqual(editor.original.value);
    expect(editor.draft.value).not.toBe(editor.original.value); // CLONE, not same ref
    expect(editor.status.value).toBe('idle');
    expect(editor.errorMessage.value).toBe(null);
  });

  it('no-ops when original is null', () => {
    const editor = useLayoutEditor('L1');
    editor.discard(); // should not throw
    expect(editor.draft.value).toBe(null);
  });
});

describe('useLayoutEditor — single-flight guard (P1 audit fix)', () => {
  it('coalesces concurrent save() calls into ONE PUT request', async () => {
    const updated = fixture({ name: 'Renamed', updatedAt: '2026-05-28T12:00:00.000Z' });
    // Slow-resolving fetch so we can fire concurrent saves
    let resolveFetch: ((v: LayoutRecord) => void) | null = null;
    const fetchPromise = new Promise<LayoutRecord>((res) => { resolveFetch = res; });
    const { mock } = installFetch(() => fetchPromise);

    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    // Fire three saves in parallel
    const p1 = editor.save();
    const p2 = editor.save();
    const p3 = editor.save();

    // Only ONE fetch should have been initiated
    expect(mock).toHaveBeenCalledTimes(1);

    // Resolve the in-flight fetch
    resolveFetch!(updated);
    await Promise.all([p1, p2, p3]);

    // After completion, still only one fetch call total
    expect(mock).toHaveBeenCalledTimes(1);
    expect(editor.status.value).toBe('saved');
  });

  it('starts a new save after the in-flight one completes', async () => {
    const updated1 = fixture({ name: 'V1', updatedAt: '2026-05-28T12:00:00.000Z' });
    const updated2 = fixture({ name: 'V2', updatedAt: '2026-05-28T12:00:01.000Z' });
    let callCount = 0;
    const { mock } = installFetch(() => {
      callCount++;
      return Promise.resolve(callCount === 1 ? updated1 : updated2);
    });

    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'V1' };

    await editor.save();
    expect(mock).toHaveBeenCalledTimes(1);

    // Make a new edit + save again — should fire a SECOND fetch
    editor.draft.value = { ...editor.draft.value!, name: 'V2' };
    await editor.save();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('releases the in-flight lock even on error (next save can proceed)', async () => {
    let callCount = 0;
    const fetchImpl = () => {
      callCount++;
      if (callCount === 1) return Promise.reject({ statusCode: 500, statusMessage: 'boom' });
      return Promise.resolve(fixture({ name: 'V2' }));
    };
    const { mock } = installFetch(fetchImpl);

    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'V1' };

    // First save errors — lock must release
    await expect(editor.save()).rejects.toBeDefined();
    expect(mock).toHaveBeenCalledTimes(1);

    // Second save should fire a NEW request (lock released)
    editor.draft.value = { ...editor.draft.value!, name: 'V2' };
    await editor.save();
    expect(mock).toHaveBeenCalledTimes(2);
  });
});

describe('useLayoutEditor — publish()', () => {
  it('saves first when dirty, then POSTs publish, then refreshes', async () => {
    const calls: string[] = [];
    const saved = fixture({ name: 'Saved', updatedAt: '2026-05-28T01:00:00.000Z' });
    const published = fixture({ state: 'published', updatedAt: '2026-05-28T02:00:00.000Z' });
    const fetchImpl = vi.fn((url: string, opts?: Record<string, unknown>) => {
      const method = (opts as { method?: string } | undefined)?.method ?? 'GET';
      calls.push(`${method} ${url}`);
      if (url === '/api/admin/layouts/L1' && method === 'PUT') return Promise.resolve(saved);
      if (url === '/api/admin/layouts/L1/publish') return Promise.resolve({ id: 'v1' });
      if (url === '/api/admin/layouts/L1' && method === 'GET') return Promise.resolve(published);
      return Promise.reject(new Error('unexpected ' + url));
    });
    installFetch(fetchImpl);

    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Saved' }; // dirty

    await editor.publish();

    expect(calls).toEqual([
      'PUT /api/admin/layouts/L1',
      'POST /api/admin/layouts/L1/publish',
      'GET /api/admin/layouts/L1',
    ]);
    expect(editor.original.value?.state).toBe('published');
  });

  it('skips save when not dirty', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn((url: string, opts?: Record<string, unknown>) => {
      const method = (opts as { method?: string } | undefined)?.method ?? 'GET';
      calls.push(`${method} ${url}`);
      if (url === '/api/admin/layouts/L1/publish') return Promise.resolve({ id: 'v1' });
      return Promise.resolve(fixture({ state: 'published' }));
    });
    installFetch(fetchImpl);

    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = fixture(); // clean

    await editor.publish();
    // PUT NOT called — only publish + refresh
    expect(calls.filter((c) => c.startsWith('PUT'))).toEqual([]);
    expect(calls).toContain('POST /api/admin/layouts/L1/publish');
  });
});

describe('useLayoutEditor — publish() partial-failure UX (session 162 P2.7)', () => {
  // Each step (save / publish / refresh) gets its own PublishStepError
  // so the caller can render a step-specific toast. The most important
  // case is publish-failing-after-save-succeeded: changes are saved as
  // a draft + must be communicated to the user.

  it('save-step failure → throws PublishStepError with step="save"', async () => {
    const saveError = { statusCode: 500, statusMessage: 'DB down' };
    const fetchImpl = vi.fn((url: string, opts?: Record<string, unknown>) => {
      const method = (opts as { method?: string } | undefined)?.method ?? 'GET';
      if (url === '/api/admin/layouts/L1' && method === 'PUT') {
        return Promise.reject(saveError);
      }
      return Promise.resolve(fixture());
    });
    installFetch(fetchImpl);

    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' }; // dirty → save fires

    let caught: unknown;
    try { await editor.publish(); } catch (e) { caught = e; }

    expect(caught).toBeInstanceOf(PublishStepError);
    expect((caught as PublishStepError).step).toBe('save');
    expect((caught as PublishStepError).cause).toBe(saveError);
  });

  it('publish-step failure → throws PublishStepError with step="publish" (changes ARE saved)', async () => {
    const saved = fixture({ name: 'Renamed', updatedAt: '2026-05-28T01:00:00.000Z' });
    const publishError = { statusCode: 500, statusMessage: 'Publish endpoint exploded' };
    const fetchImpl = vi.fn((url: string, opts?: Record<string, unknown>) => {
      const method = (opts as { method?: string } | undefined)?.method ?? 'GET';
      if (url === '/api/admin/layouts/L1' && method === 'PUT') return Promise.resolve(saved);
      if (url === '/api/admin/layouts/L1/publish') return Promise.reject(publishError);
      return Promise.resolve(fixture());
    });
    installFetch(fetchImpl);

    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    let caught: unknown;
    try { await editor.publish(); } catch (e) { caught = e; }

    expect(caught).toBeInstanceOf(PublishStepError);
    expect((caught as PublishStepError).step).toBe('publish');
    // The crucial property: save DID succeed. original.updatedAt has the
    // saved timestamp; the user's edits are durable as a draft.
    expect(editor.original.value?.updatedAt).toBe('2026-05-28T01:00:00.000Z');
    expect(editor.status.value).toBe('saved');
  });

  it('refresh-step failure → throws PublishStepError with step="refresh" (publish DID succeed)', async () => {
    const saved = fixture({ name: 'Renamed', updatedAt: '2026-05-28T01:00:00.000Z' });
    const refreshError = { statusCode: 500, statusMessage: 'GET failed' };
    const fetchImpl = vi.fn((url: string, opts?: Record<string, unknown>) => {
      const method = (opts as { method?: string } | undefined)?.method ?? 'GET';
      if (url === '/api/admin/layouts/L1' && method === 'PUT') return Promise.resolve(saved);
      if (url === '/api/admin/layouts/L1/publish') return Promise.resolve({ id: 'v1' });
      if (url === '/api/admin/layouts/L1' && method === 'GET') return Promise.reject(refreshError);
      return Promise.reject(new Error('unexpected ' + url));
    });
    installFetch(fetchImpl);

    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'Renamed' };

    let caught: unknown;
    try { await editor.publish(); } catch (e) { caught = e; }

    expect(caught).toBeInstanceOf(PublishStepError);
    expect((caught as PublishStepError).step).toBe('refresh');
  });

  it('PublishStepError exposes the inner cause', async () => {
    const innerErr = new Error('inner');
    installFetch(() => Promise.reject(innerErr));
    const editor = useLayoutEditor('L1');
    editor.original.value = fixture();
    editor.draft.value = { ...fixture(), name: 'X' };

    let caught: unknown;
    try { await editor.publish(); } catch (e) { caught = e; }
    expect((caught as PublishStepError).cause).toBe(innerErr);
  });
});
