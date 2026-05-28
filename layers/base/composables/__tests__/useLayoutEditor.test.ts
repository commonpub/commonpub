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
import { useLayoutEditor } from '../useLayoutEditor';
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
