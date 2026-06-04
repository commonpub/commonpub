import {
  contentItems,
  users,
  hubs,
  tags,
  learningPaths,
  events,
  contests,
  federatedContent,
  instanceMirrors,
  registryInstances,
  followRelationships,
  hubFollowers,
} from '@commonpub/schema';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { DB } from '../types.js';
import {
  toPublicContentSummary,
  toPublicTag,
  type PublicContentRow,
  type PublicContentSummary,
  type PublicTag,
} from './serializers.js';

/**
 * DevRel / company analytics metrics for the public API. Phase 2: instantaneous
 * aggregates read straight from denormalized counters and timestamps — no
 * per-event tracking, no new PII. Time-series (Phase 3) comes from daily rollups.
 *
 * Privacy contract (enforced here):
 * - Aggregates and intentional public leaderboards only; never per-user activity.
 * - Only published + public + non-deleted content and public-profile active users
 *   are counted, at the SQL WHERE level (so the indexes are actually used).
 * - No IP / user-agent / email / referrer is read or returned.
 * - k-anonymity (`METRICS_MIN_BUCKET`) guards any future user-pivotable breakdown
 *   (Phase 3 rollups). Phase 2 exposes only non-pivotable aggregates and the
 *   contributor leaderboard, which is intentional public attribution.
 */

/** Suppression threshold for dimensioned breakdowns over users (Phase 3 use). */
export const METRICS_MIN_BUCKET = 5;

const DAY_MS = 86_400_000;

// Counter SUMs cast to float8, not int4: a cumulative `sum(view_count)` can
// exceed int4's 2.1B ceiling on a busy instance, where `::int` would throw
// "integer out of range" and 500 the endpoint. float8 holds integer sums
// exactly up to 2^53 and the pg driver returns it as a JS number (no string
// coercion). count(*) / count(distinct) stay ::int — row counts won't overflow.

/** Published + public + non-deleted content — the only content any metric counts. */
function publicContentWhere() {
  return and(
    eq(contentItems.status, 'published'),
    eq(contentItems.visibility, 'public'),
    isNull(contentItems.deletedAt),
  );
}

// Only DB-valid, publicly-visible statuses. The events status enum is
// active|draft|published|completed|cancelled (no 'upcoming'/'past' — those are
// presentation-only labels), so the public set is published/active/completed.
const PUBLIC_EVENT_STATUSES: Array<'published' | 'active' | 'completed'> = [
  'published',
  'active',
  'completed',
];
const PUBLIC_CONTEST_STATUSES: Array<'upcoming' | 'active' | 'judging' | 'completed'> = [
  'upcoming',
  'active',
  'judging',
  'completed',
];

// --- Overview ---

export interface MetricsOverview {
  domain: string;
  generatedAt: string;
  totals: {
    users: number;
    contributors: number;
    content: { total: number; byType: Record<string, number> };
    hubs: number;
    tags: number;
    engagement: { views: number; likes: number; comments: number };
  };
  recent: {
    newUsers: { last7d: number; last30d: number };
    newContent: { last7d: number; last30d: number };
    activeContributors: { last7d: number; last30d: number };
  };
  notes: string[];
}

export async function getMetricsOverview(db: DB, domain: string): Promise<MetricsOverview> {
  const now = Date.now();
  const since7 = new Date(now - 7 * DAY_MS);
  const since30 = new Date(now - 30 * DAY_MS);
  const pub = publicContentWhere();

  const [[contentAgg], byType, [userAgg], [hubAgg], [tagAgg]] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        views: sql<number>`coalesce(sum(${contentItems.viewCount}), 0)::float8`,
        likes: sql<number>`coalesce(sum(${contentItems.likeCount}), 0)::float8`,
        comments: sql<number>`coalesce(sum(${contentItems.commentCount}), 0)::float8`,
        contributors: sql<number>`count(distinct ${contentItems.authorId})::int`,
        new7: sql<number>`count(*) FILTER (WHERE ${contentItems.publishedAt} > ${since7})::int`,
        new30: sql<number>`count(*) FILTER (WHERE ${contentItems.publishedAt} > ${since30})::int`,
        active7: sql<number>`count(distinct ${contentItems.authorId}) FILTER (WHERE ${contentItems.publishedAt} > ${since7})::int`,
        active30: sql<number>`count(distinct ${contentItems.authorId}) FILTER (WHERE ${contentItems.publishedAt} > ${since30})::int`,
      })
      .from(contentItems)
      .where(pub),
    db
      .select({ type: contentItems.type, count: sql<number>`count(*)::int` })
      .from(contentItems)
      .where(pub)
      .groupBy(contentItems.type),
    db
      .select({
        total: sql<number>`count(*)::int`,
        new7: sql<number>`count(*) FILTER (WHERE ${users.createdAt} > ${since7})::int`,
        new30: sql<number>`count(*) FILTER (WHERE ${users.createdAt} > ${since30})::int`,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.status, 'active'))),
    db.select({ total: sql<number>`count(*)::int` }).from(hubs).where(isNull(hubs.deletedAt)),
    db.select({ total: sql<number>`count(*)::int` }).from(tags),
  ]);

  const byTypeRecord: Record<string, number> = {};
  for (const r of byType) byTypeRecord[r.type] = r.count;

  return {
    domain,
    generatedAt: new Date(now).toISOString(),
    totals: {
      users: userAgg?.total ?? 0,
      contributors: contentAgg?.contributors ?? 0,
      content: { total: contentAgg?.total ?? 0, byType: byTypeRecord },
      hubs: hubAgg?.total ?? 0,
      tags: tagAgg?.total ?? 0,
      engagement: {
        views: contentAgg?.views ?? 0,
        likes: contentAgg?.likes ?? 0,
        comments: contentAgg?.comments ?? 0,
      },
    },
    recent: {
      newUsers: { last7d: userAgg?.new7 ?? 0, last30d: userAgg?.new30 ?? 0 },
      newContent: { last7d: contentAgg?.new7 ?? 0, last30d: contentAgg?.new30 ?? 0 },
      activeContributors: { last7d: contentAgg?.active7 ?? 0, last30d: contentAgg?.active30 ?? 0 },
    },
    notes: [
      'Counts cover published, public, non-deleted content and active public-profile users only.',
      'Engagement totals are cumulative; per-day engagement time-series arrives with Phase 3 rollups.',
    ],
  };
}

// --- Top content ---

export type ContentMetric = 'views' | 'likes' | 'comments';

export async function getTopContent(
  db: DB,
  domain: string,
  opts: { metric: ContentMetric; type?: 'project' | 'article' | 'blog' | 'explainer'; limit: number },
): Promise<PublicContentSummary[]> {
  const orderCol =
    opts.metric === 'likes'
      ? contentItems.likeCount
      : opts.metric === 'comments'
        ? contentItems.commentCount
        : contentItems.viewCount;

  const where = opts.type
    ? and(publicContentWhere(), eq(contentItems.type, opts.type))
    : publicContentWhere();

  const rows = await db
    .select({
      id: contentItems.id,
      type: contentItems.type,
      title: contentItems.title,
      slug: contentItems.slug,
      description: contentItems.description,
      coverImageUrl: contentItems.coverImageUrl,
      difficulty: contentItems.difficulty,
      status: contentItems.status,
      visibility: contentItems.visibility,
      publishedAt: contentItems.publishedAt,
      updatedAt: contentItems.updatedAt,
      createdAt: contentItems.createdAt,
      viewCount: contentItems.viewCount,
      likeCount: contentItems.likeCount,
      commentCount: contentItems.commentCount,
      authorId: users.id,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
    // Unique id tiebreaker keeps the ordering deterministic across equal counts.
    .where(where)
    .orderBy(desc(orderCol), desc(contentItems.id))
    .limit(opts.limit);

  return rows.map((r) =>
    toPublicContentSummary(
      {
        id: r.id,
        type: r.type,
        title: r.title,
        slug: r.slug,
        description: r.description,
        coverImageUrl: r.coverImageUrl,
        difficulty: r.difficulty,
        status: r.status,
        visibility: r.visibility,
        publishedAt: r.publishedAt,
        updatedAt: r.updatedAt ?? undefined,
        createdAt: r.createdAt ?? undefined,
        deletedAt: null,
        viewCount: r.viewCount,
        likeCount: r.likeCount,
        commentCount: r.commentCount,
        author: {
          id: r.authorId,
          username: r.authorUsername,
          displayName: r.authorDisplayName,
          avatarUrl: r.authorAvatarUrl,
        },
      } satisfies PublicContentRow,
      domain,
    ),
  );
}

// --- Trending tags ---

export async function getTrendingTags(db: DB, domain: string, limit: number): Promise<PublicTag[]> {
  const rows = await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug, usageCount: tags.usageCount })
    .from(tags)
    .where(gt(tags.usageCount, 0))
    .orderBy(desc(tags.usageCount), desc(tags.id))
    .limit(limit);
  return rows.map((r) => toPublicTag(r, domain));
}

// --- Top contributors ---

export interface MetricsTopContributor {
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  publishedContent: number;
  totalViews: number;
  totalLikes: number;
  canonicalUrl: string;
}

export async function getTopContributors(
  db: DB,
  domain: string,
  limit: number,
): Promise<MetricsTopContributor[]> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      publishedContent: sql<number>`count(${contentItems.id})::int`,
      totalViews: sql<number>`coalesce(sum(${contentItems.viewCount}), 0)::float8`,
      totalLikes: sql<number>`coalesce(sum(${contentItems.likeCount}), 0)::float8`,
    })
    .from(users)
    // INNER JOIN on the public-content predicate: users with zero public content
    // are excluded (they are not contributors), and only public content counts.
    .innerJoin(contentItems, and(eq(contentItems.authorId, users.id), publicContentWhere()))
    .where(and(eq(users.profileVisibility, 'public'), eq(users.status, 'active'), isNull(users.deletedAt)))
    .groupBy(users.id, users.username, users.displayName, users.avatarUrl)
    .orderBy(desc(sql`count(${contentItems.id})`), desc(users.id))
    .limit(limit);

  return rows.map((r) => ({
    user: { id: r.id, username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl },
    publishedContent: r.publishedContent,
    totalViews: r.totalViews,
    totalLikes: r.totalLikes,
    canonicalUrl: `https://${domain}/u/${r.username}`,
  }));
}

// --- Engagement ---

export interface MetricsEngagement {
  content: {
    published: number;
    views: number;
    likes: number;
    comments: number;
    avgViewsPerItem: number;
    likesPerView: number;
    commentsPerView: number;
  };
  learning?: { paths: number; enrollments: number; completions: number; completionRate: number };
  events?: { events: number; capacity: number; attendees: number; fillRate: number };
  contests?: { contests: number; entries: number };
}

function ratio(numerator: number, denominator: number, digits = 3): number {
  if (denominator <= 0) return 0;
  const factor = 10 ** digits;
  return Math.round((numerator / denominator) * factor) / factor;
}

export async function getEngagementMetrics(
  db: DB,
  features: { learning?: boolean; events?: boolean; contests?: boolean },
): Promise<MetricsEngagement> {
  const [contentAgg] = await db
    .select({
      published: sql<number>`count(*)::int`,
      views: sql<number>`coalesce(sum(${contentItems.viewCount}), 0)::float8`,
      likes: sql<number>`coalesce(sum(${contentItems.likeCount}), 0)::float8`,
      comments: sql<number>`coalesce(sum(${contentItems.commentCount}), 0)::float8`,
    })
    .from(contentItems)
    .where(publicContentWhere());

  const published = contentAgg?.published ?? 0;
  const views = contentAgg?.views ?? 0;
  const likes = contentAgg?.likes ?? 0;
  const comments = contentAgg?.comments ?? 0;

  const result: MetricsEngagement = {
    content: {
      published,
      views,
      likes,
      comments,
      avgViewsPerItem: ratio(views, published, 2),
      likesPerView: ratio(likes, views),
      commentsPerView: ratio(comments, views),
    },
  };

  if (features.learning) {
    const [l] = await db
      .select({
        paths: sql<number>`count(*)::int`,
        enrollments: sql<number>`coalesce(sum(${learningPaths.enrollmentCount}), 0)::float8`,
        completions: sql<number>`coalesce(sum(${learningPaths.completionCount}), 0)::float8`,
      })
      .from(learningPaths)
      .where(eq(learningPaths.status, 'published'));
    result.learning = {
      paths: l?.paths ?? 0,
      enrollments: l?.enrollments ?? 0,
      completions: l?.completions ?? 0,
      completionRate: ratio(l?.completions ?? 0, l?.enrollments ?? 0),
    };
  }

  if (features.events) {
    const [e] = await db
      .select({
        events: sql<number>`count(*)::int`,
        capacity: sql<number>`coalesce(sum(${events.capacity}), 0)::float8`,
        attendees: sql<number>`coalesce(sum(${events.attendeeCount}), 0)::float8`,
      })
      .from(events)
      .where(inArray(events.status, PUBLIC_EVENT_STATUSES));
    result.events = {
      events: e?.events ?? 0,
      capacity: e?.capacity ?? 0,
      attendees: e?.attendees ?? 0,
      fillRate: ratio(e?.attendees ?? 0, e?.capacity ?? 0),
    };
  }

  if (features.contests) {
    const [c] = await db
      .select({
        contests: sql<number>`count(*)::int`,
        entries: sql<number>`coalesce(sum(${contests.entryCount}), 0)::float8`,
      })
      .from(contests)
      .where(and(inArray(contests.status, PUBLIC_CONTEST_STATUSES), eq(contests.visibility, 'public')));
    result.contests = { contests: c?.contests ?? 0, entries: c?.entries ?? 0 };
  }

  return result;
}

// --- Federation reach (opt-in) ---

export interface MetricsFederationReach {
  knownInstances: number;
  activeMirrors: number;
  followers: number;
  inboundContent: number;
  inboundByDomain: Array<{ domain: string; count: number }>;
}

export async function getFederationReach(db: DB, limit: number): Promise<MetricsFederationReach> {
  const [[instAgg], [mirrorAgg], [userFollowers], [hubFollowerAgg], [inboundAgg], byDomain] =
    await Promise.all([
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(registryInstances)
        .where(eq(registryInstances.status, 'active')),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(instanceMirrors)
        .where(eq(instanceMirrors.status, 'active')),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(followRelationships)
        .where(eq(followRelationships.status, 'accepted')),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(hubFollowers)
        .where(eq(hubFollowers.status, 'accepted')),
      db.select({ total: sql<number>`count(*)::int` }).from(federatedContent),
      db
        .select({ domain: federatedContent.originDomain, count: sql<number>`count(*)::int` })
        .from(federatedContent)
        .groupBy(federatedContent.originDomain)
        .orderBy(desc(sql`count(*)`), desc(federatedContent.originDomain))
        .limit(limit),
    ]);

  return {
    knownInstances: instAgg?.total ?? 0,
    activeMirrors: mirrorAgg?.total ?? 0,
    followers: (userFollowers?.total ?? 0) + (hubFollowerAgg?.total ?? 0),
    inboundContent: inboundAgg?.total ?? 0,
    inboundByDomain: byDomain.map((r) => ({ domain: r.domain, count: r.count })),
  };
}
