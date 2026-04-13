import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createContent,
  listContent,
  getContentBySlug,
  updateContent,
  publishContent,
  deleteContent,
  incrementViewCount,
  createContentVersion,
  listContentVersions,
} from '../content/content.js';

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
});
