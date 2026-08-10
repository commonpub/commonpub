/**
 * Tests for `buildSaveBody` — the payload every content save and publish sends.
 *
 * Untested until session 251, which is how a `null` in an `.optional()`-but-not
 * `.nullable()` field reached the server as "expected string, received null" —
 * a 400 the author only saw as an opaque "Validation failed". These assert the
 * payload the SERVER will accept, mirroring `createContentSchema`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// Nuxt auto-imports the composable relies on at call time.
Object.assign(globalThis, {
  navigateTo: vi.fn(),
  watch: vi.fn(),
  $fetch: vi.fn(),
});

import { useContentSave } from '../useContentSave';

function make(metadata: Record<string, unknown>, over: Record<string, unknown> = {}) {
  return useContentSave({
    contentType: ref('project'),
    title: ref('My build'),
    metadata: ref(metadata),
    isNew: ref(true),
    contentId: ref(null),
    isDirty: ref(true),
    getBlockTuples: () => [['paragraph', { html: 'hi' }]],
    extractError: (e: unknown) => String(e),
    ...over,
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('buildSaveBody', () => {
  it('carries the core fields the content routes require', () => {
    const body = make({}).buildSaveBody();
    expect(body.type).toBe('project');
    expect(body.title).toBe('My build');
    expect(body.content).toEqual([['paragraph', { html: 'hi' }]]);
  });

  it('drops NULL as well as empty-string values (the session-251 400)', () => {
    // Every one of these fields is `.optional()` but NOT `.nullable()` server-side,
    // so a null is a hard 400. An editor that clears a field to null, or metadata
    // seeded from an API row, must not be able to poison the save.
    const body = make({
      coverImageUrl: null,
      bannerUrl: null,
      description: null,
      subtitle: '',
      category: '',
      difficulty: null,
      tags: null,
      categoryId: null,
    }).buildSaveBody();

    for (const k of ['coverImageUrl', 'bannerUrl', 'description', 'subtitle', 'category', 'difficulty', 'tags', 'categoryId']) {
      expect(body[k], `${k} must not be sent`).toBeUndefined();
    }
    // JSON.stringify drops undefined keys, so nothing reaches the wire.
    expect(JSON.parse(JSON.stringify(body))).not.toHaveProperty('coverImageUrl');
  });

  it('keeps legitimate falsy-but-valid values', () => {
    const body = make({ visibility: 'public', tags: [], estimatedMinutes: 5 }).buildSaveBody();
    expect(body.visibility).toBe('public');
    expect(body.tags).toEqual([]);          // an empty array is a real "no tags", not a blank
    expect(body.estimatedMinutes).toBe(5);
  });

  it('omits a blank slug entirely rather than sending one the server would reject', () => {
    expect(make({ slug: '' }).buildSaveBody()).not.toHaveProperty('slug');
    expect(make({ slug: 'my-build' }).buildSaveBody().slug).toBe('my-build');
  });

  it('resolves a datetime-local string to an absolute UTC instant', () => {
    const body = make({ scheduledAt: '2030-06-01T12:30' }).buildSaveBody();
    expect(typeof body.scheduledAt).toBe('string');
    expect(body.scheduledAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(new Date(body.scheduledAt as string).toISOString()).toBe(body.scheduledAt);
  });

  it('drops an unparseable schedule instead of sending garbage', () => {
    expect(make({ scheduledAt: 'sometime next week' }).buildSaveBody().scheduledAt).toBeUndefined();
  });
});
