import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  contentItems,
  tags,
  hubs,
  learningPaths,
  events,
  contests,
  federatedContent,
  instanceMirrors,
  registryInstances,
  followRelationships,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  getMetricsOverview,
  getTopContent,
  getTrendingTags,
  getTopContributors,
  getEngagementMetrics,
  getFederationReach,
} from '../publicApi/index.js';

const DOMAIN = 'example.com';
const NOW = new Date();
const OLD = new Date('2020-01-01T00:00:00Z');

describe('publicApi metrics (integration)', () => {
  let db: DB;
  let userA: string; // public, active — 3 public items
  let userB: string; // public, active — 1 public item
  let userC: string; // PRIVATE profile — 1 public item (counts for content, not contributors)

  beforeAll(async () => {
    db = await createTestDB();
    userA = (await createTestUser(db, { username: 'alice' })).id;
    userB = (await createTestUser(db, { username: 'bob' })).id;
    const c = await createTestUser(db, { username: 'carol' });
    userC = c.id;
    // Make carol's profile private (still active, not deleted).
    const { users } = await import('@commonpub/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(users).set({ profileVisibility: 'private' }).where(eq(users.id, userC));

    const mk = (o: {
      author: string; slug: string; type: 'project' | 'blog' | 'explainer';
      views: number; likes: number; comments: number;
      status?: 'draft' | 'published'; visibility?: 'public' | 'private';
      publishedAt?: Date | null; deletedAt?: Date | null;
    }) => ({
      authorId: o.author,
      title: o.slug,
      slug: o.slug,
      type: o.type,
      status: o.status ?? 'published',
      visibility: o.visibility ?? 'public',
      viewCount: o.views,
      likeCount: o.likes,
      commentCount: o.comments,
      publishedAt: o.publishedAt === undefined ? NOW : o.publishedAt,
      deletedAt: o.deletedAt ?? null,
    });

    await db.insert(contentItems).values([
      mk({ author: userA, slug: 'a1', type: 'project', views: 100, likes: 10, comments: 5 }),
      mk({ author: userA, slug: 'a2', type: 'blog', views: 50, likes: 5, comments: 2 }),
      mk({ author: userA, slug: 'a3', type: 'explainer', views: 10, likes: 1, comments: 0, publishedAt: OLD }),
      mk({ author: userB, slug: 'b1', type: 'blog', views: 200, likes: 20, comments: 8 }),
      mk({ author: userC, slug: 'c1', type: 'project', views: 30, likes: 3, comments: 1 }),
      // Excluded by the public-content predicate:
      mk({ author: userA, slug: 'draft', type: 'blog', views: 999, likes: 99, comments: 99, status: 'draft' }),
      mk({ author: userA, slug: 'private', type: 'blog', views: 999, likes: 99, comments: 99, visibility: 'private' }),
      mk({ author: userA, slug: 'deleted', type: 'blog', views: 999, likes: 99, comments: 99, deletedAt: NOW }),
    ]);

    await db.insert(tags).values([
      { name: 'Robotics', slug: 'robotics', usageCount: 50 },
      { name: '3D Printing', slug: '3d-printing', usageCount: 10 },
      { name: 'Unused', slug: 'unused', usageCount: 0 },
    ]);

    await db.insert(hubs).values([
      { name: 'Makers', slug: 'makers', hubType: 'community', createdById: userA },
      { name: 'Gone', slug: 'gone', hubType: 'community', createdById: userA, deletedAt: NOW },
    ]);

    await db.insert(learningPaths).values([
      { title: 'Intro', slug: 'intro', authorId: userA, status: 'published', enrollmentCount: 10, completionCount: 4 },
      { title: 'Draft Path', slug: 'draft-path', authorId: userA, status: 'draft', enrollmentCount: 99, completionCount: 99 },
    ]);

    await db.insert(events).values([
      { title: 'Meetup', slug: 'meetup', status: 'published', startDate: NOW, endDate: NOW, capacity: 50, attendeeCount: 10, createdById: userA },
      { title: 'Cancelled', slug: 'cancelled', status: 'cancelled', startDate: NOW, endDate: NOW, capacity: 999, attendeeCount: 999, createdById: userA },
    ]);

    await db.insert(contests).values([
      { title: 'Edge AI', slug: 'edge-ai', status: 'active', visibility: 'public', startDate: NOW, endDate: NOW, entryCount: 7, createdById: userA },
      { title: 'Draft Contest', slug: 'draft-contest', status: 'draft', visibility: 'public', startDate: NOW, endDate: NOW, entryCount: 99, createdById: userA },
      { title: 'Private Contest', slug: 'private-contest', status: 'active', visibility: 'private', startDate: NOW, endDate: NOW, entryCount: 99, createdById: userA },
    ]);

    await db.insert(federatedContent).values([
      { objectUri: 'https://deveco.io/o/1', actorUri: 'https://deveco.io/u/x', originDomain: 'deveco.io', apType: 'Article' },
      { objectUri: 'https://deveco.io/o/2', actorUri: 'https://deveco.io/u/y', originDomain: 'deveco.io', apType: 'Article' },
      { objectUri: 'https://heatsync.io/o/1', actorUri: 'https://heatsync.io/u/z', originDomain: 'heatsynclabs.org', apType: 'Article' },
    ]);
    await db.insert(instanceMirrors).values([
      { remoteDomain: 'deveco.io', remoteActorUri: 'https://deveco.io/actor', status: 'active', direction: 'pull' },
      { remoteDomain: 'paused.example', remoteActorUri: 'https://paused.example/actor', status: 'paused', direction: 'pull' },
    ]);
    await db.insert(registryInstances).values([
      { domain: 'deveco.io', actorUri: 'https://deveco.io/actor', status: 'active' },
      { domain: 'hidden.example', actorUri: 'https://hidden.example/actor', status: 'hidden' },
    ]);
    await db.insert(followRelationships).values([
      { followerActorUri: 'https://deveco.io/u/x', followingActorUri: 'https://example.com/actor', status: 'accepted' },
      { followerActorUri: 'https://deveco.io/u/y', followingActorUri: 'https://example.com/actor', status: 'pending' },
    ]);
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('getMetricsOverview', () => {
    it('counts only public published content and active users; excludes drafts/private/deleted', async () => {
      const o = await getMetricsOverview(db, DOMAIN);
      expect(o.totals.content.total).toBe(5);
      expect(o.totals.content.byType).toEqual({ project: 2, blog: 2, explainer: 1 });
      expect(o.totals.engagement).toEqual({ views: 390, likes: 39, comments: 16 });
      expect(o.totals.contributors).toBe(3); // alice, bob, carol (distinct authors of public content)
      expect(o.totals.users).toBe(3); // carol is private-profile but still an active user
      expect(o.totals.hubs).toBe(1); // 'gone' is soft-deleted
      expect(o.totals.tags).toBe(3);
      expect(o.domain).toBe(DOMAIN);
    });

    it('windows new content / active contributors by publishedAt (a3 is old)', async () => {
      const o = await getMetricsOverview(db, DOMAIN);
      expect(o.recent.newContent.last7d).toBe(4); // a1,a2,b1,c1 recent; a3 is 2020
      expect(o.recent.newContent.last30d).toBe(4);
      expect(o.recent.activeContributors.last7d).toBe(3);
      expect(o.recent.newUsers.last7d).toBe(3);
    });
  });

  describe('getTopContent', () => {
    it('orders by views desc with id tiebreaker and excludes non-public', async () => {
      const top = await getTopContent(db, DOMAIN, { metric: 'views', limit: 10 });
      expect(top.map((t) => t.slug)).toEqual(['b1', 'a1', 'a2', 'c1', 'a3']);
      expect(top[0]!.viewCount).toBe(200);
      expect(top[0]!.canonicalUrl).toBe('https://example.com/u/bob/blog/b1');
      // Never leak draft/private/deleted.
      expect(top.some((t) => ['draft', 'private', 'deleted'].includes(t.slug))).toBe(false);
    });

    it('orders by likes and respects the type filter + limit', async () => {
      const byLikes = await getTopContent(db, DOMAIN, { metric: 'likes', limit: 2 });
      expect(byLikes.map((t) => t.slug)).toEqual(['b1', 'a1']);
      const blogs = await getTopContent(db, DOMAIN, { metric: 'views', type: 'blog', limit: 10 });
      expect(blogs.map((t) => t.slug)).toEqual(['b1', 'a2']);
    });
  });

  describe('getTrendingTags', () => {
    it('orders by usage desc and excludes unused tags', async () => {
      const t = await getTrendingTags(db, DOMAIN, 10);
      expect(t.map((x) => x.slug)).toEqual(['robotics', '3d-printing']);
      expect(t[0]!.usageCount).toBe(50);
      expect(t[0]!.canonicalUrl).toBe('https://example.com/tags/robotics');
    });
  });

  describe('getTopContributors', () => {
    it('ranks public-profile users by public content; excludes the private-profile author', async () => {
      const c = await getTopContributors(db, DOMAIN, 10);
      expect(c.map((x) => x.user.username)).toEqual(['alice', 'bob']); // carol excluded (private)
      expect(c[0]!.publishedContent).toBe(3);
      expect(c[0]!.totalViews).toBe(160); // 100 + 50 + 10 (incl. the old a3)
      expect(c[0]!.totalLikes).toBe(16);
      expect(c[0]!.canonicalUrl).toBe('https://example.com/u/alice');
      expect(c[1]!.publishedContent).toBe(1);
      expect(c[1]!.totalViews).toBe(200);
    });
  });

  describe('getEngagementMetrics', () => {
    it('computes content ratios and feature-gated sections', async () => {
      const e = await getEngagementMetrics(db, { learning: true, events: true, contests: true });
      expect(e.content).toMatchObject({ published: 5, views: 390, likes: 39, comments: 16 });
      expect(e.content.avgViewsPerItem).toBe(78);
      expect(e.content.likesPerView).toBeCloseTo(0.1, 5);
      expect(e.learning).toEqual({ paths: 1, enrollments: 10, completions: 4, completionRate: 0.4 });
      expect(e.events).toEqual({ events: 1, capacity: 50, attendees: 10, fillRate: 0.2 });
      expect(e.contests).toEqual({ contests: 1, entries: 7 });
    });

    it('omits sections when the feature is off', async () => {
      const e = await getEngagementMetrics(db, {});
      expect(e.learning).toBeUndefined();
      expect(e.events).toBeUndefined();
      expect(e.contests).toBeUndefined();
      expect(e.content.published).toBe(5);
    });
  });

  describe('getFederationReach', () => {
    it('aggregates peers, mirrors, followers, and inbound-by-domain', async () => {
      const f = await getFederationReach(db, 10);
      expect(f.knownInstances).toBe(1); // only the 'active' registry row
      expect(f.activeMirrors).toBe(1); // only the 'active' mirror
      expect(f.followers).toBe(1); // only the 'accepted' follow
      expect(f.inboundContent).toBe(3);
      expect(f.inboundByDomain).toEqual([
        { domain: 'deveco.io', count: 2 },
        { domain: 'heatsynclabs.org', count: 1 },
      ]);
    });
  });
});

describe('publicApi metrics — int4 overflow safety (regression)', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
    const author = (await createTestUser(db, { username: 'whale' })).id;
    // Two rows just under int4 max each; their sum (4e9) exceeds int4's 2.147e9
    // ceiling, so a `sum(...)::int` would throw "integer out of range".
    const big = 2_000_000_000;
    await db.insert(contentItems).values([
      { authorId: author, title: 'big1', slug: 'big1', type: 'blog', status: 'published', visibility: 'public', viewCount: big, publishedAt: NOW },
      { authorId: author, title: 'big2', slug: 'big2', type: 'blog', status: 'published', visibility: 'public', viewCount: big, publishedAt: NOW },
    ]);
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('sums view counts beyond int4 max without throwing (float8)', async () => {
    const o = await getMetricsOverview(db, DOMAIN);
    expect(o.totals.engagement.views).toBe(4_000_000_000);
    const e = await getEngagementMetrics(db, {});
    expect(e.content.views).toBe(4_000_000_000);
  });
});
