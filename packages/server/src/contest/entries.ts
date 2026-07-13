import { eq, and, or, desc, sql } from 'drizzle-orm';
import { contests, contestEntries, users, contentItems } from '@commonpub/schema';
import type { DB } from '../types.js';
import { normalizePagination, countRows } from '../query.js';
import { isEliminated } from './stages.js';
import type { ContestEntryItem, JudgeScoreEntry } from './types.js';

// Contest entry lifecycle: list / fetch / submit (attach published content) /
// withdraw, plus the final rank computation. The form-first proposal path lives
// in submissions.ts; contest reads/visibility live in read.ts.

export async function listContestEntries(
  db: DB,
  contestId: string,
  opts: {
    limit?: number;
    offset?: number;
    /** Include per-judge scores + written feedback. Privileged viewers only. */
    includeJudgeScores?: boolean;
    /**
     * Whether the aggregate `score` is exposed. When false, `score` is nulled
     * out for every entry so running averages don't leak during judging.
     * Defaults to true (server-internal callers see everything).
     */
    revealScores?: boolean;
    /**
     * Result ordering. `recent` (default) = newest submission first (the entries
     * grid). `rank` = final standings (rank asc, then score desc) — used by the
     * results leaderboard so the top finalists surface regardless of submit time.
     */
    orderBy?: 'recent' | 'rank';
    /** Include per-stage artifacts on EVERY entry. Privileged viewers only. */
    includeStageSubmissions?: boolean;
    /** Additionally include per-stage artifacts on this user's OWN entries
     *  (the entrant always sees what they submitted). */
    stageSubmissionsViewerId?: string;
    /**
     * Hide entries whose backing content isn't published (a proposal DRAFT
     * placeholder must not be listed publicly — its "View the project" link 404s
     * for non-owners). Set for non-privileged callers; privileged callers
     * (owner/admin/judge) see the full field including drafts. The `viewerId`
     * always sees their OWN entries regardless of content status, so an entrant's
     * draft proposal stays in their `myEntries` (the submit-form gating relies on it).
     */
    onlyPublishedContent?: boolean;
    /** The viewer, whose own entries stay visible under `onlyPublishedContent`. */
    viewerId?: string;
  } = {},
): Promise<{ items: ContestEntryItem[]; total: number }> {
  const revealScores = opts.revealScores ?? true;
  const { limit, offset } = normalizePagination(opts);
  // Public callers only see entries backed by published + PUBLIC content; the viewer
  // always sees their own. Privileged callers omit `onlyPublishedContent` → no filter.
  // (P-1b: a members/private project submitted as an entry must not leak its
  // title/slug/cover/author through the public entries grid — the status gate alone
  // let a published-but-members item through.)
  const livePublicEntry = and(
    eq(contentItems.status, 'published'),
    eq(contentItems.visibility, 'public'),
  )!;
  const contentVisible = opts.onlyPublishedContent
    ? (opts.viewerId
        ? or(livePublicEntry, eq(contestEntries.userId, opts.viewerId))
        : livePublicEntry)
    : undefined;
  const where = contentVisible
    ? and(eq(contestEntries.contestId, contestId), contentVisible)
    : eq(contestEntries.contestId, contestId);
  // `rank`: ranked entries first (1,2,3…), unranked last; ties broken by score
  // then recency. `recent`: submission order (default).
  const order =
    opts.orderBy === 'rank'
      ? [
          sql`${contestEntries.rank} asc nulls last`,
          sql`${contestEntries.score} desc nulls last`,
          desc(contestEntries.submittedAt),
          desc(contestEntries.id),
        ]
      : [desc(contestEntries.submittedAt), desc(contestEntries.id)];

  const [rows, total] = await Promise.all([
    db
      .select({
        entry: contestEntries,
        content: {
          title: contentItems.title,
          slug: contentItems.slug,
          type: contentItems.type,
          coverImageUrl: contentItems.coverImageUrl,
        },
        author: {
          displayName: users.displayName,
          username: users.username,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(contestEntries)
      .innerJoin(contentItems, eq(contestEntries.contentId, contentItems.id))
      .innerJoin(users, eq(contestEntries.userId, users.id))
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset(offset),
    // The count must mirror the visibility filter. When it references
    // contentItems.status, the count needs the same join (countRows is join-less).
    contentVisible
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(contestEntries)
          .innerJoin(contentItems, eq(contestEntries.contentId, contentItems.id))
          .where(where)
          .then((r) => r[0]?.count ?? 0)
      : countRows(db, contestEntries, where),
  ]);

  const items = rows.map((row) => {
    const item: ContestEntryItem = {
      id: row.entry.id,
      contestId: row.entry.contestId,
      contentId: row.entry.contentId,
      userId: row.entry.userId,
      score: revealScores ? row.entry.score : null,
      rank: row.entry.rank,
      // The cohort outcome (advanced/eliminated) is public, but the per-round
      // snapshot SCORE honours revealScores like the live aggregate — otherwise
      // a judges-only/private contest leaks round scores through the snapshots.
      // Rank stays (mirrors the always-exposed top-level rank, so winners can
      // be announced).
      stageState: revealScores
        ? row.entry.stageState ?? []
        : (row.entry.stageState ?? []).map((s) => ({ ...s, score: null })),
      eliminated: isEliminated(row.entry),
      submittedAt: row.entry.submittedAt,
      contentTitle: row.content.title,
      contentSlug: row.content.slug,
      contentType: row.content.type,
      contentCoverImageUrl: row.content.coverImageUrl,
      authorName: row.author.displayName ?? row.author.username,
      authorUsername: row.author.username,
      authorAvatarUrl: row.author.avatarUrl,
    };
    if (opts.includeJudgeScores) {
      item.judgeScores = (row.entry.judgeScores ?? []) as JudgeScoreEntry[];
    }
    if (opts.includeStageSubmissions || (opts.stageSubmissionsViewerId && row.entry.userId === opts.stageSubmissionsViewerId)) {
      item.stageSubmissions = row.entry.stageSubmissions ?? [];
    }
    return item;
  });

  return { items, total };
}

/**
 * One enriched entry by id — content + author info, per-stage artifacts, and
 * per-judge scores. Server-internal: the route layer gates who may see the
 * artifacts/scores (judges/owner/admin + the entrant themselves).
 */
export async function getContestEntry(db: DB, entryId: string): Promise<ContestEntryItem | null> {
  const rows = await db
    .select({
      entry: contestEntries,
      content: {
        title: contentItems.title,
        slug: contentItems.slug,
        type: contentItems.type,
        status: contentItems.status,
        visibility: contentItems.visibility,
        coverImageUrl: contentItems.coverImageUrl,
      },
      author: {
        displayName: users.displayName,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(contestEntries)
    .innerJoin(contentItems, eq(contestEntries.contentId, contentItems.id))
    .innerJoin(users, eq(contestEntries.userId, users.id))
    .where(eq(contestEntries.id, entryId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.entry.id,
    contestId: row.entry.contestId,
    contentId: row.entry.contentId,
    userId: row.entry.userId,
    score: row.entry.score,
    rank: row.entry.rank,
    stageState: row.entry.stageState ?? [],
    eliminated: isEliminated(row.entry),
    stageSubmissions: row.entry.stageSubmissions ?? [],
    submittedAt: row.entry.submittedAt,
    contentTitle: row.content.title,
    contentSlug: row.content.slug,
    contentType: row.content.type,
    contentStatus: row.content.status,
    contentVisibility: row.content.visibility,
    contentCoverImageUrl: row.content.coverImageUrl,
    authorName: row.author.displayName ?? row.author.username,
    authorUsername: row.author.username,
    authorAvatarUrl: row.author.avatarUrl,
    judgeScores: (row.entry.judgeScores ?? []) as JudgeScoreEntry[],
  };
}

export async function submitContestEntry(
  db: DB,
  contestId: string,
  contentId: string,
  userId: string,
): Promise<ContestEntryItem | null> {
  // Validate contest exists and is active
  const contest = await db
    .select({
      id: contests.id,
      status: contests.status,
      eligibleContentTypes: contests.eligibleContentTypes,
      maxEntriesPerUser: contests.maxEntriesPerUser,
    })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (contest.length === 0) return null;
  const c = contest[0]!;
  if (c.status !== 'active') return null;

  // Validate content exists, is published, and user owns it
  const content = await db
    .select({ id: contentItems.id, authorId: contentItems.authorId, status: contentItems.status, type: contentItems.type })
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);

  if (content.length === 0) return null;
  if (content[0]!.status !== 'published') return null;
  if (content[0]!.authorId !== userId) return null;

  // Per-contest entry eligibility: content type must be allowed (if restricted).
  const eligible = c.eligibleContentTypes ?? null;
  if (eligible && eligible.length > 0 && !eligible.includes(content[0]!.type)) return null;

  // Per-user entry cap (if set).
  if (c.maxEntriesPerUser != null) {
    const existingCount = await countRows(
      db,
      contestEntries,
      and(eq(contestEntries.contestId, contestId), eq(contestEntries.userId, userId)),
    );
    if (existingCount >= c.maxEntriesPerUser) return null;
  }

  // Atomic: insert the entry and bump the denormalized entryCount together, so a
  // duplicate (onConflictDoNothing → no row) never increments and a mid-operation
  // failure can't leave entryCount overcounting.
  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(contestEntries)
      .values({ contestId, contentId, userId })
      .onConflictDoNothing()
      .returning();

    if (!inserted) return null;

    await tx
      .update(contests)
      .set({ entryCount: sql`${contests.entryCount} + 1` })
      .where(eq(contests.id, contestId));

    return inserted;
  });

  if (!row) return null;

  // Fetch enriched content + author info
  const enriched = await db
    .select({
      content: {
        title: contentItems.title,
        slug: contentItems.slug,
        type: contentItems.type,
        coverImageUrl: contentItems.coverImageUrl,
      },
      author: {
        displayName: users.displayName,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
    .where(eq(contentItems.id, contentId))
    .limit(1);

  const info = enriched[0];

  return {
    id: row.id,
    contestId: row.contestId,
    contentId: row.contentId,
    userId: row.userId,
    score: row.score,
    rank: row.rank,
    stageState: [], // a freshly submitted entry is in the active cohort
    eliminated: false,
    submittedAt: row.submittedAt,
    contentTitle: info?.content.title ?? 'Untitled',
    contentSlug: info?.content.slug ?? '',
    contentType: info?.content.type ?? 'project',
    contentCoverImageUrl: info?.content.coverImageUrl ?? null,
    authorName: info?.author.displayName ?? info?.author.username ?? 'Unknown',
    authorUsername: info?.author.username ?? '',
    authorAvatarUrl: info?.author.avatarUrl ?? null,
  };
}

export async function withdrawContestEntry(
  db: DB,
  entryId: string,
  userId: string,
): Promise<{ withdrawn: boolean; error?: string }> {
  const existing = await db
    .select({
      entry: contestEntries,
      contestStatus: contests.status,
      contentStatus: contentItems.status,
    })
    .from(contestEntries)
    .innerJoin(contests, eq(contestEntries.contestId, contests.id))
    .innerJoin(contentItems, eq(contestEntries.contentId, contentItems.id))
    .where(eq(contestEntries.id, entryId))
    .limit(1);

  if (existing.length === 0) return { withdrawn: false, error: 'Entry not found' };

  const row = existing[0]!;
  if (row.entry.userId !== userId) return { withdrawn: false, error: 'Not the entry owner' };
  if (row.contestStatus !== 'active') {
    return { withdrawn: false, error: 'Can only withdraw from active contests' };
  }

  // A proposal-created draft placeholder (never developed into a published entry)
  // is litter once its entry is withdrawn — archive it so it doesn't orphan a stub
  // project in the entrant's drafts. A placeholder the entrant DEVELOPED and
  // published (status no longer 'draft') is their real entry and is left as-is, as
  // is any normal attached project (placeholder === false).
  const archivePlaceholder = row.entry.placeholder && row.contentStatus === 'draft';

  // Atomic: delete + the denormalized entryCount decrement (+ the placeholder
  // archive) commit together, so a mid-operation failure can't leave entryCount
  // overcounting or orphan the stub (mirrors the transactional insert in
  // submitContestEntry).
  await db.transaction(async (tx) => {
    await tx.delete(contestEntries).where(eq(contestEntries.id, entryId));
    await tx
      .update(contests)
      .set({ entryCount: sql`GREATEST(${contests.entryCount} - 1, 0)` })
      .where(eq(contests.id, row.entry.contestId));
    if (archivePlaceholder) {
      // Soft-delete (archive), matching deleteContent — kept inline to stay in the
      // withdraw transaction. Scoped to the owner as defense in depth.
      await tx
        .update(contentItems)
        .set({ status: 'archived', deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(contentItems.id, row.entry.contentId), eq(contentItems.authorId, userId)));
    }
  });

  return { withdrawn: true };
}

export async function calculateContestRanks(
  db: DB,
  contestId: string,
): Promise<void> {
  // Assign ranks by score with RANK() so tied scores share a rank (1, 1, 3…).
  // Only scored entries are ranked; entries that were never judged keep a null
  // rank rather than being handed an arbitrary trailing position.
  // Eliminated entries (culled at a prior review stage, Phase B2) are excluded
  // from ranking — only the surviving cohort competes for the final placements.
  await db.execute(sql`
    UPDATE ${contestEntries}
    SET rank = ranked.rn
    FROM (
      SELECT id, RANK() OVER (ORDER BY score DESC) AS rn
      FROM ${contestEntries}
      WHERE contest_id = ${contestId} AND score IS NOT NULL
        AND NOT (stage_state @> '[{"status":"eliminated"}]'::jsonb)
    ) AS ranked
    WHERE ${contestEntries}.id = ranked.id
  `);
  // Clear ranks for entries with no score (unjudged) or that were eliminated.
  await db.execute(sql`
    UPDATE ${contestEntries}
    SET rank = NULL
    WHERE contest_id = ${contestId}
      AND (score IS NULL OR stage_state @> '[{"status":"eliminated"}]'::jsonb)
  `);
}
