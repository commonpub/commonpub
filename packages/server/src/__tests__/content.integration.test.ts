import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createContent,
  listContent,
  getContentBySlug,
  updateContent,
  publishContent,
  scheduleContent,
  publishDueScheduled,
  deleteContent,
  incrementViewCount,
  createContentVersion,
  listContentVersions,
} from '../content/content.js';
import type { CommonPubConfig } from '@commonpub/config';

const TEST_CONFIG = { features: { federation: false }, instance: { domain: '' } } as unknown as CommonPubConfig;

describe('content integration', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db);
    userId = user.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('creates a draft content item', async () => {
    const result = await createContent(db, userId, {
      type: 'article',
      title: 'Test Article',
      description: 'A test article',
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.title).toBe('Test Article');
    expect(result.slug).toMatch(/^test-article/);
    expect(result.status).toBe('draft');
    expect(result.type).toBe('blog'); // article normalized to blog
  });

  it('lists content with filters', async () => {
    const result = await listContent(db, { status: 'draft' });

    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items[0]!.status).toBe('draft');
  });

  it('gets content by slug', async () => {
    const created = await createContent(db, userId, {
      type: 'project',
      title: 'My Test Project',
    });

    const found = await getContentBySlug(db, created.slug, userId);
    expect(found).toBeDefined();
    expect(found!.title).toBe('My Test Project');
    expect(found!.type).toBe('project');
  });

  it('updates content', async () => {
    const created = await createContent(db, userId, {
      type: 'blog',
      title: 'Draft Blog Post',
    });

    const updated = await updateContent(db, created.id, userId, {
      title: 'Updated Blog Post',
      description: 'Now with a description',
    });

    expect(updated).toBeDefined();
    expect(updated!.title).toBe('Updated Blog Post');
  });

  it('publishes content and sets publishedAt', async () => {
    const created = await createContent(db, userId, {
      type: 'article',
      title: 'To Be Published',
    });

    const published = await publishContent(db, created.id, userId);
    expect(published).toBeDefined();
    expect(published!.status).toBe('published');
    expect(published!.publishedAt).toBeDefined();
  });

  it('increments view count', async () => {
    const created = await createContent(db, userId, {
      type: 'article',
      title: 'Viewable Article',
    });

    await incrementViewCount(db, created.id);
    await incrementViewCount(db, created.id);

    const found = await getContentBySlug(db, created.slug, userId);
    expect(found!.viewCount).toBe(2);
  });

  it('generates unique slugs for duplicate titles', async () => {
    const first = await createContent(db, userId, {
      type: 'article',
      title: 'Duplicate Title',
    });
    const second = await createContent(db, userId, {
      type: 'article',
      title: 'Duplicate Title',
    });

    expect(first.slug).not.toBe(second.slug);
  });

  it('soft deletes content', async () => {
    const created = await createContent(db, userId, {
      type: 'article',
      title: 'To Be Deleted',
    });

    await deleteContent(db, created.id, userId);

    // Should not appear in listings
    const list = await listContent(db, { status: 'draft' });
    const found = list.items.find((i) => i.id === created.id);
    expect(found).toBeUndefined();
  });

  it('creates a content version on publish', async () => {
    const created = await createContent(db, userId, {
      type: 'article',
      title: 'Versioned Article',
    });

    await publishContent(db, created.id, userId);
    await createContentVersion(db, created.id, userId);

    const versions = await listContentVersions(db, created.id);
    expect(versions.length).toBeGreaterThanOrEqual(1);
  });

  it('sanitizes XSS in BlockTuple content on create', async () => {
    const result = await createContent(db, userId, {
      type: 'article',
      title: 'XSS Test',
      content: [['text', { html: '<p>Hello</p><script>alert(1)</script>' }]],
    });

    const fetched = await getContentBySlug(db, result.slug, userId);
    const blocks = fetched!.content as [string, Record<string, unknown>][];
    const htmlField = blocks[0]![1].html as string;
    expect(htmlField).not.toContain('<script>');
    expect(htmlField).toContain('Hello');
  });

  it('sanitizes XSS in ExplainerDocument content on create', async () => {
    const explainerDoc = {
      version: 2,
      theme: 'dark-industrial',
      hero: { title: 'Test', subtitle: '<script>alert("xss")</script>safe text' },
      sections: [
        {
          id: 'sec1',
          anchor: 'test',
          heading: 'Test Section',
          body: '<p>Good</p><script>evil()</script>',
          bridge: '<em>ok</em><img src=x onerror=alert(1)>',
          aside: { icon: 'test', label: 'Note', text: '<script>bad()</script>safe' },
        },
      ],
      conclusion: { heading: 'End', body: '<p>Done</p><script>hack()</script>' },
      meta: { estimatedMinutes: 5, difficulty: 'beginner' },
    };

    const result = await createContent(db, userId, {
      type: 'explainer',
      title: 'XSS Explainer Test',
      content: explainerDoc,
    });

    const fetched = await getContentBySlug(db, result.slug, userId);
    const doc = fetched!.content as Record<string, unknown>;
    expect(doc.version).toBe(2);

    // Hero subtitle sanitized
    const hero = doc.hero as Record<string, unknown>;
    expect(hero.subtitle).not.toContain('<script>');
    expect(hero.subtitle as string).toContain('safe text');

    // Section body sanitized
    const sections = doc.sections as Array<Record<string, unknown>>;
    expect(sections[0]!.body).not.toContain('<script>');
    expect(sections[0]!.body as string).toContain('Good');

    // Bridge sanitized
    expect(sections[0]!.bridge).not.toContain('onerror');

    // Aside text sanitized
    const aside = sections[0]!.aside as Record<string, unknown>;
    expect(aside.text).not.toContain('<script>');
    expect(aside.text as string).toContain('safe');

    // Conclusion body sanitized
    const conclusion = doc.conclusion as Record<string, unknown>;
    expect(conclusion.body).not.toContain('<script>');
    expect(conclusion.body as string).toContain('Done');
  });

  it('filters by type', async () => {
    const result = await listContent(db, { type: 'project', status: 'draft' });
    for (const item of result.items) {
      expect(item.type).toBe('project');
    }
  });

  it('supports pagination', async () => {
    const all = await listContent(db, { limit: 100 });
    const page1 = await listContent(db, { limit: 2, offset: 0 });
    const page2 = await listContent(db, { limit: 2, offset: 2 });

    expect(page1.items.length).toBeLessThanOrEqual(2);
    expect(page1.total).toBe(all.total);
    if (all.total > 2) {
      expect(page2.items[0]!.id).not.toBe(page1.items[0]!.id);
    }
  });

  // Regression (session 177 load-more dup bug): when includeFederated is on, the
  // merged stream must be sliced [offset, offset+limit) — the old code fetched
  // [0, offset+limit) then sliced (0, limit), so every "load more" re-showed page 1.
  // This manifests from the LOCAL slice math alone (no federated rows needed):
  // localOffset=0 + slice(0,limit) returns the head on every page.
  it('paginates without duplicates when includeFederated is on', async () => {
    for (let i = 0; i < 4; i++) {
      const c = await createContent(db, userId, {
        type: 'blog',
        title: `Fed Page Item ${i}`,
        description: `item ${i}`,
      });
      await publishContent(db, c.id, userId);
    }

    const page1 = await listContent(
      db,
      { type: 'blog', status: 'published', limit: 2, offset: 0 },
      { includeFederated: true },
    );
    const page2 = await listContent(
      db,
      { type: 'blog', status: 'published', limit: 2, offset: 2 },
      { includeFederated: true },
    );

    expect(page1.items.length).toBe(2);
    expect(page2.items.length).toBeGreaterThanOrEqual(1);

    const page1Ids = new Set(page1.items.map((i) => i.id));
    const overlap = page2.items.filter((i) => page1Ids.has(i.id));
    expect(overlap).toEqual([]);
  });

  // Regression (deveco load-more dup): with includeFederated on, the merge sorts
  // by publishedAt. If sort:'popular' lets the LOCAL slice order by viewCount, the
  // viewCount-ordered local set feeds a publishedAt-ordered merge → mismatched
  // keys → inconsistent page windows → dups. The merged feed must be chronological.
  it('paginates sort:popular + includeFederated without duplicates (forced recency)', async () => {
    const made: string[] = [];
    for (let i = 0; i < 6; i++) {
      const c = await createContent(db, userId, {
        type: 'blog',
        title: `Fed Popular ${i}`,
        description: `fp ${i}`,
      });
      await publishContent(db, c.id, userId);
      made.push(c.id);
    }
    // Bump viewCounts so viewCount-order diverges from publishedAt-order — this is
    // what exposes the key mismatch when the local slice isn't forced to recency.
    for (let i = 0; i < made.length; i++) {
      for (let v = 0; v < i; v++) await incrementViewCount(db, made[i]!);
    }

    const seen = new Set<string>();
    let dupes = 0;
    for (let offset = 0; offset < 6; offset += 2) {
      const page = await listContent(
        db,
        { type: 'blog', status: 'published', sort: 'popular', limit: 2, offset },
        { includeFederated: true },
      );
      for (const item of page.items) {
        if (seen.has(item.id)) dupes++;
        seen.add(item.id);
      }
    }
    expect(dupes).toBe(0);
  });

  // Regression (homepage "For You" load-more dup): sort:'popular' orders by
  // viewCount, which is 0 (tied) for most content. Without a unique tiebreaker
  // the tied rows come back in an unstable order, so LIMIT/OFFSET pages overlap.
  // Seed several published items all at viewCount 0 and assert pages are disjoint.
  it('paginates sort:popular without duplicates when viewCounts tie', async () => {
    for (let i = 0; i < 6; i++) {
      const c = await createContent(db, userId, {
        type: 'blog',
        title: `Popular Tie Item ${i}`,
        description: `tie ${i}`,
      });
      await publishContent(db, c.id, userId);
      // leave viewCount at its default (0) so every row ties on the sort key
    }

    const seen = new Set<string>();
    let dupes = 0;
    for (let offset = 0; offset < 6; offset += 2) {
      const page = await listContent(db, {
        type: 'blog',
        status: 'published',
        sort: 'popular',
        limit: 2,
        offset,
      });
      for (const item of page.items) {
        if (seen.has(item.id)) dupes++;
        seen.add(item.id);
      }
    }
    expect(dupes).toBe(0);
  });

  // --- Custom slug (editor slug field was previously a silent no-op) ---

  it('honors a custom slug on create (normalized)', async () => {
    const created = await createContent(db, userId, {
      type: 'blog',
      title: 'Some Generic Title',
      slug: 'My Custom URL!',
    });
    expect(created.slug).toBe('my-custom-url');
  });

  it('changes the slug on update when a custom slug is supplied, without touching the title', async () => {
    const created = await createContent(db, userId, { type: 'blog', title: 'Stable Title' });
    const originalSlug = created.slug;

    const updated = await updateContent(db, created.id, userId, { slug: 'brand-new-slug' });
    expect(updated!.slug).toBe('brand-new-slug');
    expect(updated!.slug).not.toBe(originalSlug);
    expect(updated!.title).toBe('Stable Title');

    // The new slug is the one that resolves.
    const found = await getContentBySlug(db, 'brand-new-slug', userId);
    expect(found!.id).toBe(created.id);
  });

  it('leaves the slug unchanged when neither slug nor title change', async () => {
    const created = await createContent(db, userId, { type: 'blog', title: 'Keep My Slug' });
    const updated = await updateContent(db, created.id, userId, { description: 'desc only' });
    expect(updated!.slug).toBe(created.slug);
  });

  // --- Scheduled publishing ---

  it('persists scheduledAt and status via scheduleContent', async () => {
    const created = await createContent(db, userId, { type: 'blog', title: 'Scheduled Post' });
    const when = new Date(Date.now() + 60 * 60 * 1000); // 1h out

    const scheduled = await scheduleContent(db, created.id, userId, when);
    expect(scheduled!.status).toBe('scheduled');
    expect(scheduled!.scheduledAt).toBeInstanceOf(Date);
    expect(scheduled!.scheduledAt!.getTime()).toBe(when.getTime());
    expect(scheduled!.publishedAt).toBeNull();
  });

  it('scheduleContent rejects a non-owner', async () => {
    const other = await createTestUser(db, { username: 'sched-intruder' });
    const created = await createContent(db, userId, { type: 'blog', title: 'Owned Post' });
    const result = await scheduleContent(db, created.id, other.id, new Date(Date.now() + 1000));
    expect(result).toBeNull();
  });

  it('refuses to schedule an already-published item (no silent unpublish)', async () => {
    const item = await createContent(db, userId, { type: 'blog', title: 'Already Live' });
    await publishContent(db, item.id, userId);

    const result = await scheduleContent(db, item.id, userId, new Date(Date.now() + 60 * 60 * 1000));
    expect(result).toBeNull();

    // Still published, not reverted to scheduled.
    const after = await getContentBySlug(db, item.slug, userId);
    expect(after!.status).toBe('published');
  });

  it('updateContent rejects status=scheduled with no scheduledAt (no stuck state via generic PUT)', async () => {
    const item = await createContent(db, userId, { type: 'blog', title: 'No Time Schedule' });
    await expect(updateContent(db, item.id, userId, { status: 'scheduled' })).rejects.toThrow();
    // Unchanged — still a visible draft, not a hidden status=scheduled/null row.
    const after = await getContentBySlug(db, item.slug, userId);
    expect(after!.status).toBe('draft');
  });

  it('updateContent rejects scheduling an already-published item (no silent unpublish via generic PUT)', async () => {
    const item = await createContent(db, userId, { type: 'blog', title: 'Live Then Schedule' });
    await publishContent(db, item.id, userId);
    await expect(
      updateContent(db, item.id, userId, { status: 'scheduled', scheduledAt: new Date(Date.now() + 3600_000) }),
    ).rejects.toThrow();
    const after = await getContentBySlug(db, item.slug, userId);
    expect(after!.status).toBe('published');
  });

  it('publishDueScheduled publishes only items whose time has passed', async () => {
    const due = await createContent(db, userId, { type: 'blog', title: 'Due Now' });
    const future = await createContent(db, userId, { type: 'blog', title: 'Not Yet' });

    await scheduleContent(db, due.id, userId, new Date(Date.now() - 60 * 1000)); // past
    await scheduleContent(db, future.id, userId, new Date(Date.now() + 60 * 60 * 1000)); // future

    const count = await publishDueScheduled(db, TEST_CONFIG);
    expect(count).toBeGreaterThanOrEqual(1);

    const publishedNow = await getContentBySlug(db, due.slug, userId);
    expect(publishedNow!.status).toBe('published');
    expect(publishedNow!.publishedAt).toBeInstanceOf(Date);
    expect(publishedNow!.scheduledAt).toBeNull();

    const stillScheduled = await getContentBySlug(db, future.slug, userId);
    expect(stillScheduled!.status).toBe('scheduled');
  });

  it('publishDueScheduled is idempotent — a second run publishes nothing new', async () => {
    const item = await createContent(db, userId, { type: 'blog', title: 'Idempotent Schedule' });
    await scheduleContent(db, item.id, userId, new Date(Date.now() - 1000));

    const first = await publishDueScheduled(db, TEST_CONFIG);
    expect(first).toBeGreaterThanOrEqual(1);
    const second = await publishDueScheduled(db, TEST_CONFIG);
    expect(second).toBe(0);
  });

  it('publishing a scheduled item creates a version snapshot', async () => {
    const item = await createContent(db, userId, { type: 'blog', title: 'Versioned Schedule' });
    await scheduleContent(db, item.id, userId, new Date(Date.now() - 1000));
    await publishDueScheduled(db, TEST_CONFIG);

    const versions = await listContentVersions(db, item.id);
    expect(versions.length).toBeGreaterThanOrEqual(1);
  });
});
