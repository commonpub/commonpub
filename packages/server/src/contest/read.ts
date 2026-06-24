import { eq, ne, and, or, desc, sql, inArray } from 'drizzle-orm';
import { contests, contestJudges, contestStakeholders } from '@commonpub/schema';
import type { ContestStatus } from '@commonpub/schema';
import type { DB } from '../types.js';
import { normalizePagination, countRows } from '../query.js';
import { isContestStakeholder } from './stakeholders.js';
import { isContestJudge } from './judges.js';
import type {
  ContestFilters,
  ContestListItem,
  ContestDetail,
  ContestVisibility,
  ContestJudgingVisibility,
} from './types.js';

// Contest read path: listing (visibility-filtered), detail mapping, per-contest
// view authorization, and the score-reveal decision. Writers live in contest.ts.

export async function listContests(
  db: DB,
  filters: ContestFilters = {},
  viewer?: { userId: string; role: string } | null,
): Promise<{ items: ContestListItem[]; total: number }> {
  const conditions = [];

  if (filters.status) {
    conditions.push(
      eq(contests.status, filters.status),
    );
  }

  // Visibility: admins see everything. Everyone else sees `public` contests,
  // plus — when signed in — the ones they have a relationship to so they're not
  // hidden in the listing: their own, ones they review (stakeholder), ones they
  // judge, and private ones whose `visibleToRoles` includes their role. (`unlisted`
  // stays link-only; mirrors canViewContest so the listing matches per-contest access.)
  if (viewer?.role !== 'admin') {
    const visConds = [eq(contests.visibility, 'public')];
    if (viewer?.userId) {
      visConds.push(eq(contests.createdById, viewer.userId));
      visConds.push(
        inArray(
          contests.id,
          db.select({ id: contestStakeholders.contestId }).from(contestStakeholders).where(eq(contestStakeholders.userId, viewer.userId)),
        ),
      );
      visConds.push(
        inArray(
          contests.id,
          db.select({ id: contestJudges.contestId }).from(contestJudges).where(eq(contestJudges.userId, viewer.userId)),
        ),
      );
    }
    if (viewer?.role) {
      visConds.push(sql`${contests.visibleToRoles} @> ${JSON.stringify([viewer.role])}::jsonb`);
    }
    conditions.push(visConds.length > 1 ? or(...visConds)! : visConds[0]!);

    // Drafts never appear in listings except to their own owner (admins, handled
    // above, see everything). Orthogonal to visibility — a public draft is still hidden.
    conditions.push(
      viewer?.userId
        ? or(ne(contests.status, 'draft'), eq(contests.createdById, viewer.userId))!
        : ne(contests.status, 'draft'),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const { limit, offset } = normalizePagination(filters);

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(contests)
      .where(where)
      .orderBy(desc(contests.startDate), desc(contests.id))
      .limit(limit)
      .offset(offset),
    countRows(db, contests, where),
  ]);

  const items: ContestListItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    subheading: row.subheading,
    description: row.description,
    bannerUrl: row.bannerUrl,
    coverImageUrl: row.coverImageUrl,
    coverMeta: row.coverMeta ?? null,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    entryCount: row.entryCount,
    createdAt: row.createdAt,
  }));

  return { items, total };
}

type ContestRow = typeof contests.$inferSelect;

/** Map a contest row to the API detail shape. Shared by the CRUD writers. */
export function toContestDetail(row: ContestRow): ContestDetail {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    bannerUrl: row.bannerUrl,
    coverImageUrl: row.coverImageUrl,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    entryCount: row.entryCount,
    createdAt: row.createdAt,
    subheading: row.subheading,
    rules: row.rules,
    prizesDescription: row.prizesDescription,
    descriptionFormat: row.descriptionFormat,
    rulesFormat: row.rulesFormat,
    prizesDescriptionFormat: row.prizesDescriptionFormat,
    descriptionBlocks: (row.descriptionBlocks as unknown[] | null) ?? null,
    rulesBlocks: (row.rulesBlocks as unknown[] | null) ?? null,
    prizesBlocks: (row.prizesBlocks as unknown[] | null) ?? null,
    showPrizes: row.showPrizes,
    bannerMeta: row.bannerMeta ?? null,
    coverMeta: row.coverMeta ?? null,
    coverPlacement: row.coverPlacement ?? null,
    stages: row.stages ?? [],
    currentStageId: row.currentStageId ?? null,
    prizes: row.prizes ?? null,
    judgingCriteria: row.judgingCriteria ?? null,
    judgingVisibility: row.judgingVisibility,
    judgingEndDate: row.judgingEndDate,
    communityVotingEnabled: row.communityVotingEnabled,
    eligibleContentTypes: row.eligibleContentTypes ?? null,
    maxEntriesPerUser: row.maxEntriesPerUser ?? null,
    visibility: row.visibility,
    visibleToRoles: row.visibleToRoles ?? null,
    createdById: row.createdById,
  };
}

/**
 * Whether `user` may view this contest. `public`/`unlisted` are viewable by
 * anyone (unlisted is simply hidden from listings). `private` is restricted to
 * the owner, admins, stakeholders, panel judges, and users whose role is in
 * `visibleToRoles`.
 */
export async function canViewContest(
  db: DB,
  contest: { id: string; status?: string; visibility: ContestVisibility; visibleToRoles: string[] | null; createdById: string },
  user: { id: string; role: string } | null,
): Promise<boolean> {
  // Drafts are owner-only regardless of the visibility setting — an unlaunched
  // contest must never be world-readable, even when its visibility is `public`.
  if (contest.status === 'draft') {
    if (!user) return false;
    if (user.id === contest.createdById || user.role === 'admin') return true;
    if (await isContestStakeholder(db, contest.id, user.id)) return true;
    if (await isContestJudge(db, contest.id, user.id)) return true;
    return false;
  }
  if (contest.visibility !== 'private') return true;
  if (!user) return false;
  if (user.id === contest.createdById || user.role === 'admin') return true;
  if (contest.visibleToRoles && contest.visibleToRoles.includes(user.role)) return true;
  if (await isContestStakeholder(db, contest.id, user.id)) return true;
  if (await isContestJudge(db, contest.id, user.id)) return true;
  return false;
}

export async function getContestBySlug(
  db: DB,
  slug: string,
): Promise<ContestDetail | null> {
  const rows = await db
    .select()
    .from(contests)
    .where(eq(contests.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;
  return toContestDetail(rows[0]!);
}

/**
 * Decide whether a viewer may see aggregate entry scores, honouring the
 * contest's `judgingVisibility` setting. Pure + exhaustively testable.
 *
 * - Privileged viewers (owner / admin / panel judge) always see scores.
 * - `public`     → scores visible to everyone (during judging and after).
 * - `judges-only`→ scores hidden from the public until the contest completes.
 * - `private`    → aggregate scores never exposed to the public (ranks may
 *                  still be shown so winners can be announced).
 */
export function shouldRevealScores(
  visibility: ContestJudgingVisibility,
  status: ContestStatus,
  privileged: boolean,
): boolean {
  if (privileged) return true;
  if (visibility === 'public') return true;
  if (visibility === 'private') return false;
  return status === 'completed';
}
