/**
 * P-1 content-visibility enforcement (docs/plans/content-privacy-enforcement.md).
 *
 * Closes a LIVE unauthenticated leak: `content_items.visibility` (public|members|private)
 * was enforced on almost no read path. The verified predicate — matching the three
 * already-safe paths (resolveContentQuery, content-ap.ts, public/v1) — is:
 *
 *   readable IFF requesterId === authorId (any status/visibility)
 *           OR (status='published' AND visibility='public' AND deletedAt IS NULL)
 *
 * These tests seed members / private / public / draft items (plus a soft-deleted one)
 * and assert every content READ helper honours that predicate for a non-author while
 * still serving the author their own work.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { contentItems, hubShares } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createContent, getContentBySlug, listContent } from '../content/content.js';
import { visibleContentWhere } from '../content/visibility.js';
import { getUserContent } from '../profile/profile.js';
import { searchWithPostgres, searchContent, type MeiliClient } from '../search/contentSearch.js';
import { createProduct, addContentProduct, listProductContent, listHubGallery } from '../product/product.js';
import { createHub } from '../hub/hub.js';
import { createPath, createModule, createLesson, publishPath, getLessonBySlug } from '../learning/learning.js';
import { createComment, listComments } from '../social/social.js';

type Visibility = 'public' | 'members' | 'private';

describe('P-1 content visibility enforcement', () => {
  let db: DB;
  let authorId: string;
  let otherId: string;

  // Seeded content ids/slugs
  let pub: { id: string; slug: string };
  let mem: { id: string; slug: string };
  let priv: { id: string; slug: string };
  let draft: { id: string; slug: string };

  async function seed(
    title: string,
    visibility: Visibility,
    status: 'draft' | 'published' = 'published',
  ): Promise<{ id: string; slug: string }> {
    const c = await createContent(db, authorId, { type: 'project', title, visibility });
    if (status === 'published') {
      await db
        .update(contentItems)
        .set({ status: 'published', publishedAt: new Date() })
        .where(eq(contentItems.id, c.id));
    }
    return { id: c.id, slug: c.slug };
  }

  beforeAll(async () => {
    db = await createTestDB();
    const a = await createTestUser(db, { username: 'author-p1' });
    authorId = a.id;
    const b = await createTestUser(db, { username: 'other-p1' });
    otherId = b.id;

    pub = await seed('P1 Public ZorptheWidget', 'public');
    mem = await seed('P1 Members ZorptheWidget', 'members');
    priv = await seed('P1 Private ZorptheWidget', 'private');
    draft = await seed('P1 Draft ZorptheWidget', 'public', 'draft');
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // ---- Site 1: getContentBySlug (main detail) ----
  describe('getContentBySlug', () => {
    it('serves public published to anon, non-author, and author', async () => {
      expect(await getContentBySlug(db, pub.slug, undefined)).not.toBeNull();
      expect(await getContentBySlug(db, pub.slug, otherId)).not.toBeNull();
      expect(await getContentBySlug(db, pub.slug, authorId)).not.toBeNull();
    });

    it('hides members-only from anon and non-author, serves author', async () => {
      expect(await getContentBySlug(db, mem.slug, undefined)).toBeNull();
      expect(await getContentBySlug(db, mem.slug, otherId)).toBeNull();
      expect(await getContentBySlug(db, mem.slug, authorId)).not.toBeNull();
    });

    it('hides private from anon and non-author, serves author', async () => {
      expect(await getContentBySlug(db, priv.slug, undefined)).toBeNull();
      expect(await getContentBySlug(db, priv.slug, otherId)).toBeNull();
      expect(await getContentBySlug(db, priv.slug, authorId)).not.toBeNull();
    });

    it('hides a public DRAFT from anon and non-author, serves author', async () => {
      expect(await getContentBySlug(db, draft.slug, undefined)).toBeNull();
      expect(await getContentBySlug(db, draft.slug, otherId)).toBeNull();
      expect(await getContentBySlug(db, draft.slug, authorId)).not.toBeNull();
    });
  });

  // ---- visibleContentWhere helper (composed by gallery/search) ----
  describe('visibleContentWhere', () => {
    it('anon predicate matches only public published, not members/private/draft', async () => {
      const rows = await db
        .select({ id: contentItems.id })
        .from(contentItems)
        .where(visibleContentWhere());
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(pub.id);
      expect(ids).not.toContain(mem.id);
      expect(ids).not.toContain(priv.id);
      expect(ids).not.toContain(draft.id);
    });

    it('author predicate additionally matches the author own members/private/draft', async () => {
      const rows = await db
        .select({ id: contentItems.id })
        .from(contentItems)
        .where(visibleContentWhere(authorId));
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(pub.id);
      expect(ids).toContain(mem.id);
      expect(ids).toContain(priv.id);
      expect(ids).toContain(draft.id);
    });
  });

  // ---- Sites 3/4: feed contract via listContent ----
  describe('listContent feed contract (status=published + visibility=public)', () => {
    it('returns only public items for the visibility=public filter the feeds pass', async () => {
      const { items } = await listContent(db, { status: 'published', visibility: 'public' });
      const ids = items.map((i) => i.id);
      expect(ids).toContain(pub.id);
      expect(ids).not.toContain(mem.id);
      expect(ids).not.toContain(priv.id);
    });
  });

  // ---- Site 8: getUserContent (profile listing) ----
  describe('getUserContent', () => {
    it('shows a non-owner only the author public published items', async () => {
      const { items } = await getUserContent(db, authorId, { viewerId: otherId });
      const ids = items.map((i) => i.id);
      expect(ids).toContain(pub.id);
      expect(ids).not.toContain(mem.id);
      expect(ids).not.toContain(priv.id);
    });

    it('shows an anonymous viewer only public published items', async () => {
      const { items } = await getUserContent(db, authorId, {});
      const ids = items.map((i) => i.id);
      expect(ids).toContain(pub.id);
      expect(ids).not.toContain(mem.id);
      expect(ids).not.toContain(priv.id);
    });

    it('shows the owner their own published members/private items', async () => {
      const { items } = await getUserContent(db, authorId, { viewerId: authorId });
      const ids = items.map((i) => i.id);
      expect(ids).toContain(pub.id);
      expect(ids).toContain(mem.id);
      expect(ids).toContain(priv.id);
    });
  });

  // ---- Sites 6/7: search ----
  describe('searchWithPostgres', () => {
    it('excludes members/private for a non-author (default anon requester)', async () => {
      const { items } = await searchWithPostgres(db, { query: 'ZorptheWidget' });
      const ids = items.map((i) => i.id);
      expect(ids).toContain(pub.id);
      expect(ids).not.toContain(mem.id);
      expect(ids).not.toContain(priv.id);
    });

    it('includes the author own members/private when requesterId is the author', async () => {
      const { items } = await searchWithPostgres(db, { query: 'ZorptheWidget', requesterId: authorId });
      const ids = items.map((i) => i.id);
      expect(ids).toContain(pub.id);
      expect(ids).toContain(mem.id);
      expect(ids).toContain(priv.id);
    });
  });

  describe('searchContent Meilisearch filter construction', () => {
    function captureMeili(): { client: MeiliClient; filters: string[] } {
      const filters: string[] = [];
      const client: MeiliClient = {
        index() {
          return {
            search(_q: string, options?: Record<string, unknown>) {
              if (options && typeof options.filter === 'string') filters.push(options.filter);
              return Promise.resolve({ hits: [], estimatedTotalHits: 0, totalHits: 0 });
            },
            addDocuments: () => Promise.resolve(),
            updateDocuments: () => Promise.resolve(),
            deleteDocuments: () => Promise.resolve(),
            updateFilterableAttributes: () => Promise.resolve(),
            updateSearchableAttributes: () => Promise.resolve(),
            updateSortableAttributes: () => Promise.resolve(),
          };
        },
      };
      return { client, filters };
    }

    it('restricts the Meili filter to public visibility for an anonymous requester', async () => {
      const { client, filters } = captureMeili();
      await searchContent(db, { query: 'ZorptheWidget' }, client);
      expect(filters.length).toBeGreaterThan(0);
      expect(filters[0]).toContain('visibility = "public"');
    });

    it('widens the Meili filter to the author own content when a requesterId is passed', async () => {
      const { client, filters } = captureMeili();
      await searchContent(db, { query: 'ZorptheWidget', requesterId: authorId }, client);
      expect(filters.length).toBeGreaterThan(0);
      expect(filters[0]).toContain('visibility = "public"');
      expect(filters[0]).toContain(`authorId = "${authorId}"`);
    });
  });

  // ---- Site 9 + 19: listProductContent ----
  describe('listProductContent', () => {
    it('returns only public published, excluding members/private and soft-deleted', async () => {
      const phub = await createHub(db, authorId, { name: 'P1 Product Owner Hub' });
      const product = await createProduct(db, authorId, phub.id, { name: 'P1 Gallery Product' });
      // A public item that we soft-delete after linking (site 19 resurface guard)
      const deletedPub = await seed('P1 Deleted Public Gallery', 'public');
      for (const c of [pub, mem, priv, deletedPub]) {
        await addContentProduct(db, c.id, { productId: product.id });
      }
      await db.update(contentItems).set({ deletedAt: new Date() }).where(eq(contentItems.id, deletedPub.id));

      const { items } = await listProductContent(db, product.id);
      const ids = items.map((i) => i.id);
      expect(ids).toContain(pub.id);
      expect(ids).not.toContain(mem.id);
      expect(ids).not.toContain(priv.id);
      expect(ids).not.toContain(deletedPub.id);
    });
  });

  // ---- Site 14 + 19: listHubGallery (community hub → hubShares) ----
  describe('listHubGallery (community)', () => {
    it('returns only public published shares, excluding members/private and soft-deleted', async () => {
      const hub = await createHub(db, authorId, { name: 'P1 Gallery Hub' });
      const deletedShare = await seed('P1 Deleted Public Share', 'public');
      for (const c of [pub, mem, priv, deletedShare]) {
        await db.insert(hubShares).values({ hubId: hub.id, contentId: c.id, sharedById: authorId });
      }
      await db.update(contentItems).set({ deletedAt: new Date() }).where(eq(contentItems.id, deletedShare.id));

      const { items } = await listHubGallery(db, hub.id);
      const ids = items.map((i) => i.id);
      expect(ids).toContain(pub.id);
      expect(ids).not.toContain(mem.id);
      expect(ids).not.toContain(priv.id);
      expect(ids).not.toContain(deletedShare.id);
    });
  });

  // ---- Site 17: getLessonBySlug on a draft learning path ----
  describe('getLessonBySlug', () => {
    it('hides a lesson whose path is draft from a non-author, serves the author', async () => {
      const path = await createPath(db, authorId, { title: 'P1 Draft Path' });
      const mod = await createModule(db, authorId, { pathId: path.id, title: 'Mod' });
      const lesson = await createLesson(db, authorId, { moduleId: mod.id, title: 'Lesson One', type: 'article' });

      expect(await getLessonBySlug(db, path.slug, lesson.slug, undefined)).toBeNull();
      expect(await getLessonBySlug(db, path.slug, lesson.slug, otherId)).toBeNull();
      expect(await getLessonBySlug(db, path.slug, lesson.slug, authorId)).not.toBeNull();
    });

    it('serves a lesson on a published path to anyone', async () => {
      const path = await createPath(db, authorId, { title: 'P1 Published Path' });
      const mod = await createModule(db, authorId, { pathId: path.id, title: 'Mod' });
      const lesson = await createLesson(db, authorId, { moduleId: mod.id, title: 'Lesson Two', type: 'article' });
      await publishPath(db, path.id, authorId);

      expect(await getLessonBySlug(db, path.slug, lesson.slug, undefined)).not.toBeNull();
    });
  });

  // ---- Site 18: listComments gated on parent content visibility ----
  describe('listComments', () => {
    it('hides comments on a members-only item from a non-author, serves the author', async () => {
      await createComment(db, authorId, { targetType: 'project', targetId: mem.id, content: 'hidden comment' });
      expect(await listComments(db, 'project', mem.id, 20, 0, undefined)).toHaveLength(0);
      expect(await listComments(db, 'project', mem.id, 20, 0, otherId)).toHaveLength(0);
      expect((await listComments(db, 'project', mem.id, 20, 0, authorId)).length).toBeGreaterThan(0);
    });

    it('serves comments on a public item to anyone', async () => {
      await createComment(db, otherId, { targetType: 'project', targetId: pub.id, content: 'public comment' });
      expect((await listComments(db, 'project', pub.id, 20, 0, undefined)).length).toBeGreaterThan(0);
    });
  });
});
