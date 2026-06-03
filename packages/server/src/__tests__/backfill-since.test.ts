import { describe, it, expect } from 'vitest';
import { activityPublishedMs } from '../federation/backfill.js';

/**
 * The `since` bound on backfill stops crawling once it pages past the cutoff (newest-first
 * outbox). That hinges on reliably reading an activity's publish time from either the
 * top-level `published` (our projected outbox Creates set this) or `object.published`
 * (Mastodon-style). This locks the extraction.
 */
describe('activityPublishedMs', () => {
  it('reads top-level published', () => {
    const ms = activityPublishedMs({ type: 'Create', published: '2026-05-01T00:00:00.000Z' });
    expect(ms).toBe(Date.parse('2026-05-01T00:00:00.000Z'));
  });

  it('falls back to object.published', () => {
    const ms = activityPublishedMs({ type: 'Create', object: { published: '2026-04-01T12:00:00.000Z' } });
    expect(ms).toBe(Date.parse('2026-04-01T12:00:00.000Z'));
  });

  it('prefers top-level over object', () => {
    const ms = activityPublishedMs({
      published: '2026-05-01T00:00:00.000Z',
      object: { published: '2020-01-01T00:00:00.000Z' },
    });
    expect(ms).toBe(Date.parse('2026-05-01T00:00:00.000Z'));
  });

  it('returns null when no usable date is present', () => {
    expect(activityPublishedMs({ type: 'Create' })).toBeNull();
    expect(activityPublishedMs({ published: 'not-a-date' })).toBeNull();
    expect(activityPublishedMs({ object: { published: 42 } })).toBeNull();
  });

  it('compares correctly against a cutoff (the actual stop condition)', () => {
    const since = Date.parse('2026-05-01T00:00:00.000Z');
    const newer = activityPublishedMs({ published: '2026-05-15T00:00:00.000Z' })!;
    const older = activityPublishedMs({ published: '2026-04-15T00:00:00.000Z' })!;
    expect(newer < since).toBe(false); // kept
    expect(older < since).toBe(true); // triggers stop
  });
});
