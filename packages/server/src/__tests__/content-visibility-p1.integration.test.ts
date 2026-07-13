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
import { contentItems, hubShares, contests } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createContent, getContentBySlug, listContent } from '../content/content.js';
import { visibleContentWhere } from '../content/visibility.js';
import { getUserContent, getUserByUsername } from '../profile/profile.js';
import { searchWithPostgres, searchContent, type MeiliClient } from '../search/contentSearch.js';
import { createProduct, addContentProduct, listProductContent, listHubGallery } from '../product/product.js';
import { createHub } from '../hub/hub.js';
import { createPath, createModule, createLesson, publishPath, getLessonBySlug } from '../learning/learning.js';
import { createComment, listComments, toggleBookmark, listUserBookmarks } from '../social/social.js';
import { createContest, submitContestEntry, listContestEntries, getContestEntry } from '../contest/index.js';

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

  // ---- P-1b: getLessonBySlug linked-content body ----
  describe('getLessonBySlug linked-content (P-1b)', () => {
    it('hides the linked content body of a members/private item on a PUBLISHED path', async () => {
      const path = await createPath(db, authorId, { title: 'P1b Linked Path' });
      const mod = await createModule(db, authorId, { pathId: path.id, title: 'Mod' });
      const lesson = await createLesson(db, authorId, {
        moduleId: mod.id,
        title: 'Linked Members Lesson',
        type: 'article',
        contentItemId: mem.id,
      });
      await publishPath(db, path.id, authorId);

      // The path is published (served to anyone) but the LINKED item is members-only:
      // its body must not leak to a non-author, yet the author still sees it.
      const anon = await getLessonBySlug(db, path.slug, lesson.slug, undefined);
      expect(anon).not.toBeNull();
      expect(anon!.linkedContent).toBeUndefined();

      const owner = await getLessonBySlug(db, path.slug, lesson.slug, authorId);
      expect(owner!.linkedContent).toBeDefined();
      expect(owner!.linkedContent!.id).toBe(mem.id);
    });

    it('serves a public linked item to anyone', async () => {
      const path = await createPath(db, authorId, { title: 'P1b Linked Public Path' });
      const mod = await createModule(db, authorId, { pathId: path.id, title: 'Mod' });
      const lesson = await createLesson(db, authorId, {
        moduleId: mod.id,
        title: 'Linked Public Lesson',
        type: 'article',
        contentItemId: pub.id,
      });
      await publishPath(db, path.id, authorId);
      const anon = await getLessonBySlug(db, path.slug, lesson.slug, undefined);
      expect(anon!.linkedContent).toBeDefined();
      expect(anon!.linkedContent!.id).toBe(pub.id);
    });
  });

  // ---- P-1b: related-content inside getContentBySlug ----
  describe('getContentBySlug related-content (P-1b)', () => {
    it('excludes the author OWN members/private items from the related sidebar', async () => {
      // pub, mem, priv are all type=project by the same author; viewing pub as anon,
      // the related list must surface neither mem nor priv.
      const detail = await getContentBySlug(db, pub.slug, undefined);
      expect(detail).not.toBeNull();
      const relatedIds = (detail!.related ?? []).map((r) => r.id);
      expect(relatedIds).not.toContain(mem.id);
      expect(relatedIds).not.toContain(priv.id);
    });
  });

  // ---- P-1b: getUserByUsername profile stats ----
  describe('getUserByUsername stats (P-1b)', () => {
    it('counts/aggregates only the author live-public content', async () => {
      const u = await createTestUser(db, { username: 'p1b-profile' });
      const mkProject = async (visibility: Visibility, viewCount: number): Promise<void> => {
        const c = await createContent(db, u.id, { type: 'project', title: `P1b stat ${visibility} ${viewCount}`, visibility });
        await db
          .update(contentItems)
          .set({ status: 'published', publishedAt: new Date(), viewCount })
          .where(eq(contentItems.id, c.id));
      };
      await mkProject('public', 10);
      await mkProject('members', 100);
      await mkProject('private', 1000);

      const profile = await getUserByUsername(db, 'p1b-profile');
      expect(profile).not.toBeNull();
      // Only the single public project is counted; the members/private aren't.
      expect(profile!.stats.projects).toBe(1);
      // totalViews reflects the public item's 10 views only (not 100 + 1000).
      expect(profile!.viewCount).toBe(10);
    });
  });

  // ---- P-1b: listUserBookmarks joined-content visibility ----
  describe('listUserBookmarks (P-1b)', () => {
    it('hides a bookmark of another user item that has since gone private, keeps own', async () => {
      // otherId bookmarks the author's public item, then the author flips it private.
      await toggleBookmark(db, otherId, 'project', pub.id);
      const before = await listUserBookmarks(db, otherId);
      expect(before.items.some((b) => b.content?.id === pub.id)).toBe(true);

      await db.update(contentItems).set({ visibility: 'private' }).where(eq(contentItems.id, pub.id));
      const after = await listUserBookmarks(db, otherId);
      // Bookmark row is preserved but its content metadata is withheld.
      const stillListed = after.items.find((b) => b.targetId === pub.id);
      expect(stillListed).toBeDefined();
      expect(stillListed!.content).toBeNull();

      // Restore for downstream tests.
      await db.update(contentItems).set({ visibility: 'public' }).where(eq(contentItems.id, pub.id));
    });

    it('keeps the owner OWN now-private bookmarked item visible', async () => {
      const mine = await createContent(db, otherId, { type: 'project', title: 'P1b My Bookmarked Private', visibility: 'private' });
      await db.update(contentItems).set({ status: 'published', publishedAt: new Date() }).where(eq(contentItems.id, mine.id));
      await toggleBookmark(db, otherId, 'project', mine.id);
      const list = await listUserBookmarks(db, otherId);
      const own = list.items.find((b) => b.targetId === mine.id);
      expect(own?.content?.id).toBe(mine.id);
    });
  });

  // ---- P-1b: contest entries (list + detail) visibility ----
  describe('contest entries (P-1b)', () => {
    it('hides a members/private published entry from the public list, keeps the entrant own view', async () => {
      const contest = await createContest(db, {
        title: 'P1b Entry Contest',
        slug: `p1b-entry-contest-${Date.now()}`,
        description: 'x',
        startDate: new Date('2026-04-01').toISOString(),
        endDate: new Date('2026-05-01').toISOString(),
        createdBy: authorId,
      });
      await db.update(contests).set({ status: 'active' }).where(eq(contests.id, contest.id));

      // author submits their PUBLISHED public item + their PUBLISHED members item.
      await submitContestEntry(db, contest.id, pub.id, authorId);
      const memEntry = await submitContestEntry(db, contest.id, mem.id, authorId);
      expect(memEntry).not.toBeNull();

      // Public (non-privileged) listing excludes the members entry.
      const pubList = await listContestEntries(db, contest.id, { onlyPublishedContent: true });
      const pubIds = pubList.items.map((e) => e.contentId);
      expect(pubIds).toContain(pub.id);
      expect(pubIds).not.toContain(mem.id);

      // The entrant sees their own members entry.
      const mine = await listContestEntries(db, contest.id, { onlyPublishedContent: true, viewerId: authorId });
      expect(mine.items.map((e) => e.contentId)).toContain(mem.id);

      // A different viewer does NOT.
      const otherView = await listContestEntries(db, contest.id, { onlyPublishedContent: true, viewerId: otherId });
      expect(otherView.items.map((e) => e.contentId)).not.toContain(mem.id);
    });

    it('getContestEntry exposes contentVisibility so the detail route can gate', async () => {
      const contest = await createContest(db, {
        title: 'P1b Detail Contest',
        slug: `p1b-detail-contest-${Date.now()}`,
        description: 'x',
        startDate: new Date('2026-04-01').toISOString(),
        endDate: new Date('2026-05-01').toISOString(),
        createdBy: authorId,
      });
      await db.update(contests).set({ status: 'active' }).where(eq(contests.id, contest.id));
      const entry = await submitContestEntry(db, contest.id, mem.id, authorId);
      const fetched = await getContestEntry(db, entry!.id);
      expect(fetched!.contentStatus).toBe('published');
      expect(fetched!.contentVisibility).toBe('members');
    });
  });
});
