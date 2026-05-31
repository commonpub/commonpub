import { eq, and, or, desc, sql, isNotNull } from 'drizzle-orm';
import { contests, contestEntries, contestJudges, contestStakeholders, users, contentItems } from '@commonpub/schema';
import type { DB } from '../types.js';
import { normalizePagination, countRows } from '../query.js';
import { isContestStakeholder } from './stakeholders.js';
import { isContestJudge } from './judges.js';

import type { ContestStatus } from '@commonpub/schema';

export type ContestJudgingVisibility = 'public' | 'judges-only' | 'private';
export type ContestVisibility = 'public' | 'unlisted' | 'private';
export interface ContestPrize {
  place?: number;
  category?: string;
  /** Optional — a prize can be description-only (no forced placement title). */
  title?: string;
  description?: string;
  value?: string;
}
export interface ContestJudgingCriterion {
  label: string;
  weight?: number;
  description?: string;
}
export interface CriterionScore {
  label: string;
  score: number;
  max: number;
}
export interface JudgeScoreEntry {
  judgeId: string;
  score: number;
  feedback?: string;
  criteriaScores?: CriterionScore[];
}

export interface ContestListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  status: ContestStatus;
  startDate: Date;
  endDate: Date;
  entryCount: number;
  createdAt: Date;
}

export interface ContestDetail extends ContestListItem {
  subheading: string | null;
  rules: string | null;
  prizes: ContestPrize[] | null;
  judgingCriteria: ContestJudgingCriterion[] | null;
  judgingVisibility: ContestJudgingVisibility;
  judgingEndDate: Date | null;
  communityVotingEnabled: boolean;
  eligibleContentTypes: string[] | null;
  maxEntriesPerUser: number | null;
  visibility: ContestVisibility;
  visibleToRoles: string[] | null;
  createdById: string;
}

export interface ContestFilters {
  status?: ContestStatus;
  limit?: number;
  offset?: number;
}

export interface CreateContestInput {
  title: string;
  slug: string;
  subheading?: string;
  description?: string;
  rules?: string;
  bannerUrl?: string;
  prizes?: ContestPrize[];
  judgingCriteria?: ContestJudgingCriterion[];
  /** Seed-only: populates the contest_judges table at creation. */
  judges?: string[];
  communityVotingEnabled?: boolean;
  judgingVisibility?: ContestJudgingVisibility;
  eligibleContentTypes?: string[];
  maxEntriesPerUser?: number;
  visibility?: ContestVisibility;
  visibleToRoles?: string[];
  /** Seed-only: populates the contest_stakeholders table at creation. */
  stakeholders?: string[];
  startDate: string;
  endDate: string;
  judgingEndDate?: string;
  createdBy: string;
}

export interface ContestEntryItem {
  id: string;
  contestId: string;
  contentId: string;
  userId: string;
  score: number | null;
  rank: number | null;
  submittedAt: Date;
  // Enriched fields from joins
  contentTitle: string;
  contentSlug: string;
  contentType: string;
  contentCoverImageUrl: string | null;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  judgeScores?: JudgeScoreEntry[];
}

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

  // Visibility: listings only ever surface `public` contests. `unlisted` is
  // link-only (never listed); `private` is hidden. An admin sees everything; a
  // signed-in user additionally sees their own contests (so they can manage
  // drafts). Stakeholders/role-gated viewers reach private contests by link.
  if (viewer?.role !== 'admin') {
    const visConds = [eq(contests.visibility, 'public')];
    if (viewer?.userId) visConds.push(eq(contests.createdById, viewer.userId));
    conditions.push(visConds.length > 1 ? or(...visConds)! : visConds[0]!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const { limit, offset } = normalizePagination(filters);

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(contests)
      .where(where)
      .orderBy(desc(contests.startDate))
      .limit(limit)
      .offset(offset),
    countRows(db, contests, where),
  ]);

  const items: ContestListItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    bannerUrl: row.bannerUrl,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    entryCount: row.entryCount,
    createdAt: row.createdAt,
  }));

  return { items, total };
}

type ContestRow = typeof contests.$inferSelect;

function toContestDetail(row: ContestRow): ContestDetail {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    bannerUrl: row.bannerUrl,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    entryCount: row.entryCount,
    createdAt: row.createdAt,
    subheading: row.subheading,
    rules: row.rules,
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
  contest: { id: string; visibility: ContestVisibility; visibleToRoles: string[] | null; createdById: string },
  user: { id: string; role: string } | null,
): Promise<boolean> {
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
 * Check if a user role is allowed to create contests based on the instance policy.
 *
 * @param userRole - The user's role (member, pro, verified, staff, admin)
 * @param policy - The contest creation policy ('open' | 'staff' | 'admin')
 * @returns true if the user can create contests
 */
export function canCreateContest(
  userRole: string,
  policy: 'open' | 'staff' | 'admin' = 'admin',
): boolean {
  if (policy === 'open') return true;
  if (policy === 'staff') return userRole === 'staff' || userRole === 'admin';
  return userRole === 'admin';
}

export async function createContest(
  db: DB,
  input: CreateContestInput,
  options?: { userRole?: string; contestCreationPolicy?: 'open' | 'staff' | 'admin' },
): Promise<ContestDetail> {
  if (options?.userRole) {
    const policy = options.contestCreationPolicy ?? 'admin';
    if (!canCreateContest(options.userRole, policy)) {
      throw new Error(`Insufficient permissions: contest creation requires ${policy} role`);
    }
  }
  const [row] = await db
    .insert(contests)
    .values({
      title: input.title,
      slug: input.slug,
      subheading: input.subheading ?? null,
      description: input.description ?? null,
      rules: input.rules ?? null,
      bannerUrl: input.bannerUrl ?? null,
      prizes: input.prizes ?? null,
      judgingCriteria: input.judgingCriteria ?? null,
      communityVotingEnabled: input.communityVotingEnabled ?? false,
      judgingVisibility: input.judgingVisibility ?? 'judges-only',
      eligibleContentTypes: input.eligibleContentTypes ?? null,
      maxEntriesPerUser: input.maxEntriesPerUser ?? null,
      visibility: input.visibility ?? 'public',
      visibleToRoles: input.visibleToRoles ?? null,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      judgingEndDate: input.judgingEndDate ? new Date(input.judgingEndDate) : null,
      createdById: input.createdBy,
    })
    .returning();

  // Single source of truth: seed the contest_judges table from any judge IDs
  // provided at creation. The legacy `judges` jsonb column is no longer written
  // or read — authorization + display use the table exclusively.
  if (input.judges && input.judges.length > 0) {
    await db
      .insert(contestJudges)
      .values(input.judges.map((userId) => ({ contestId: row!.id, userId })))
      .onConflictDoNothing();
  }
  // Seed stakeholders (view-only reviewers) from create input.
  if (input.stakeholders && input.stakeholders.length > 0) {
    await db
      .insert(contestStakeholders)
      .values(input.stakeholders.map((userId) => ({ contestId: row!.id, userId })))
      .onConflictDoNothing();
  }

  return toContestDetail(row!);
}

export async function updateContest(
  db: DB,
  slug: string,
  userId: string,
  data: Partial<CreateContestInput>,
): Promise<ContestDetail | null> {
  const existing = await db
    .select()
    .from(contests)
    .where(eq(contests.slug, slug))
    .limit(1);

  if (existing.length === 0) return null;
  if (existing[0]!.createdById !== userId) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.subheading !== undefined) updates.subheading = data.subheading;
  if (data.description !== undefined) updates.description = data.description;
  if (data.rules !== undefined) updates.rules = data.rules;
  if (data.bannerUrl !== undefined) updates.bannerUrl = data.bannerUrl;
  if (data.prizes !== undefined) updates.prizes = data.prizes;
  if (data.judgingCriteria !== undefined) updates.judgingCriteria = data.judgingCriteria;
  // `judges` is intentionally not handled here — the contest_judges table is the
  // source of truth, managed via the dedicated /judges endpoints.
  if (data.communityVotingEnabled !== undefined) updates.communityVotingEnabled = data.communityVotingEnabled;
  if (data.judgingVisibility !== undefined) updates.judgingVisibility = data.judgingVisibility;
  if (data.eligibleContentTypes !== undefined) updates.eligibleContentTypes = data.eligibleContentTypes;
  if (data.maxEntriesPerUser !== undefined) updates.maxEntriesPerUser = data.maxEntriesPerUser;
  if (data.visibility !== undefined) updates.visibility = data.visibility;
  if (data.visibleToRoles !== undefined) updates.visibleToRoles = data.visibleToRoles;
  if (data.startDate !== undefined) updates.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updates.endDate = new Date(data.endDate);
  if (data.judgingEndDate !== undefined) updates.judgingEndDate = data.judgingEndDate ? new Date(data.judgingEndDate) : null;

  await db.update(contests).set(updates).where(eq(contests.slug, slug));

  return getContestBySlug(db, slug);
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
  } = {},
): Promise<{ items: ContestEntryItem[]; total: number }> {
  const revealScores = opts.revealScores ?? true;
  const { limit, offset } = normalizePagination(opts);
  const where = eq(contestEntries.contestId, contestId);
  // `rank`: ranked entries first (1,2,3…), unranked last; ties broken by score
  // then recency. `recent`: submission order (default).
  const order =
    opts.orderBy === 'rank'
      ? [
          sql`${contestEntries.rank} asc nulls last`,
          sql`${contestEntries.score} desc nulls last`,
          desc(contestEntries.submittedAt),
        ]
      : [desc(contestEntries.submittedAt)];

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
    countRows(db, contestEntries, where),
  ]);

  const items = rows.map((row) => {
    const item: ContestEntryItem = {
      id: row.entry.id,
      contestId: row.entry.contestId,
      contentId: row.entry.contentId,
      userId: row.entry.userId,
      score: revealScores ? row.entry.score : null,
      rank: row.entry.rank,
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
    return item;
  });

  return { items, total };
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

  const [row] = await db
    .insert(contestEntries)
    .values({ contestId, contentId, userId })
    .onConflictDoNothing()
    .returning();

  if (!row) return null;

  await db
    .update(contests)
    .set({ entryCount: sql`${contests.entryCount} + 1` })
    .where(eq(contests.id, contestId));

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

export async function judgeContestEntry(
  db: DB,
  entryId: string,
  score: number | undefined,
  judgeId: string,
  feedback?: string,
  criteriaScores?: CriterionScore[],
): Promise<{ judged: boolean; error?: string }> {
  // Get the entry and its contest (read-only validation, no lock needed).
  const existing = await db
    .select({
      contestStatus: contests.status,
      contestId: contests.id,
      entrantId: contestEntries.userId,
    })
    .from(contestEntries)
    .innerJoin(contests, eq(contestEntries.contestId, contests.id))
    .where(eq(contestEntries.id, entryId))
    .limit(1);

  if (existing.length === 0) return { judged: false, error: 'Entry not found' };

  const row = existing[0]!;

  // Check contest is in judging phase
  if (row.contestStatus !== 'judging') {
    return { judged: false, error: 'Contest is not in judging phase' };
  }

  // Conflict of interest: a judge cannot score their own entry.
  if (row.entrantId === judgeId) {
    return { judged: false, error: 'You cannot judge your own entry' };
  }

  // Check judge authorization via contestJudges table (accepted judges only)
  const [judgeRecord] = await db
    .select({ id: contestJudges.id, role: contestJudges.role, acceptedAt: contestJudges.acceptedAt })
    .from(contestJudges)
    .where(and(eq(contestJudges.contestId, row.contestId), eq(contestJudges.userId, judgeId)))
    .limit(1);

  if (!judgeRecord) {
    return { judged: false, error: 'Not authorized to judge this contest' };
  }
  if (!judgeRecord.acceptedAt) {
    return { judged: false, error: 'Judge invitation has not been accepted' };
  }
  if (judgeRecord.role === 'guest') {
    return { judged: false, error: 'Guest judges cannot submit scores' };
  }

  // Derive the overall 0–100 score. When per-criterion scores are supplied, the
  // overall is the normalized weighted sum (sum(score)/sum(max)*100), which
  // supports any weight scheme; otherwise use the supplied overall score.
  let overall: number;
  if (criteriaScores && criteriaScores.length > 0) {
    const totalMax = criteriaScores.reduce((s, c) => s + c.max, 0);
    if (totalMax <= 0) return { judged: false, error: 'Invalid judging criteria' };
    if (criteriaScores.some((c) => c.score < 0 || c.score > c.max)) {
      return { judged: false, error: 'A criterion score is out of range' };
    }
    overall = Math.round((criteriaScores.reduce((s, c) => s + c.score, 0) / totalMax) * 100);
  } else if (typeof score === 'number') {
    overall = score;
  } else {
    return { judged: false, error: 'No score provided' };
  }

  // Atomic read-modify-write: lock the entry row so two judges scoring the same
  // entry concurrently can't clobber each other's judgeScores (lost update).
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ judgeScores: contestEntries.judgeScores })
      .from(contestEntries)
      .where(eq(contestEntries.id, entryId))
      .for('update');

    const scores = (locked?.judgeScores ?? []) as JudgeScoreEntry[];
    const record: JudgeScoreEntry = { judgeId, score: overall, feedback };
    if (criteriaScores && criteriaScores.length > 0) record.criteriaScores = criteriaScores;

    const existingIdx = scores.findIndex((s) => s.judgeId === judgeId);
    if (existingIdx >= 0) scores[existingIdx] = record;
    else scores.push(record);

    const avgScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);

    await tx
      .update(contestEntries)
      .set({ judgeScores: scores, score: avgScore })
      .where(eq(contestEntries.id, entryId));

    return { judged: true };
  });
}

// --- Contest Management ---

export async function deleteContest(
  db: DB,
  contestId: string,
  userId: string,
  /**
   * When true, skip the owner check — the caller has already established a
   * managing permission (RBAC `contest.manage`) at the route boundary. Mirrors
   * `deleteEvent`'s `isAdmin` flag. Defaults false ⇒ legacy owner-only.
   */
  canManage = false,
): Promise<boolean> {
  const contest = await db
    .select({ createdById: contests.createdById })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (contest.length === 0) return false;
  if (!canManage && contest[0]!.createdById !== userId) return false;

  await db.delete(contests).where(eq(contests.id, contestId));
  return true;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  upcoming: ['active', 'cancelled'],
  active: ['judging', 'cancelled'],
  judging: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/** Format an integer rank as an ordinal: 1 → "1st", 2 → "2nd", 11 → "11th". */
function ordinalPlace(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export async function transitionContestStatus(
  db: DB,
  contestId: string,
  userId: string,
  newStatus: ContestStatus,
): Promise<{ transitioned: boolean; error?: string }> {
  const contest = await db
    .select({ createdById: contests.createdById, status: contests.status })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (contest.length === 0) return { transitioned: false, error: 'Contest not found' };
  if (contest[0]!.createdById !== userId) return { transitioned: false, error: 'Not the contest owner' };

  const currentStatus = contest[0]!.status;
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(newStatus)) {
    return { transitioned: false, error: `Cannot transition from ${currentStatus} to ${newStatus}` };
  }

  await db
    .update(contests)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(contests.id, contestId));

  if (newStatus === 'completed') {
    await calculateContestRanks(db, contestId);
  }

  // Notify contest entrants about status change (non-critical)
  try {
    const { createNotification } = await import('../notification/notification.js');
    const [contestInfo] = await db.select({ title: contests.title, slug: contests.slug, prizes: contests.prizes })
      .from(contests).where(eq(contests.id, contestId)).limit(1);

    if (contestInfo) {
      const entrants = await db.select({ userId: contestEntries.userId, rank: contestEntries.rank })
        .from(contestEntries).where(eq(contestEntries.contestId, contestId));

      const messages: Record<string, { title: string; message: string }> = {
        active: { title: 'Contest Open', message: `"${contestInfo.title}" is now accepting submissions!` },
        judging: { title: 'Judging Started', message: `"${contestInfo.title}" is now being judged.` },
        completed: { title: 'Results Posted', message: `Results for "${contestInfo.title}" are now available!` },
        cancelled: { title: 'Contest Cancelled', message: `"${contestInfo.title}" has been cancelled.` },
      };
      const msg = messages[newStatus];
      const link = `/contests/${contestInfo.slug}${newStatus === 'completed' ? '/results' : ''}`;

      if (newStatus === 'completed') {
        // Winner-aware: an entrant whose rank earns a place-prize (or, when no
        // place-prizes are defined, places in the top 3) gets a congratulatory
        // alert naming their placement + prize; everyone else gets the standard
        // "results posted" note.
        const placePrize = new Map<number, { title?: string; value?: string }>();
        for (const p of contestInfo.prizes ?? []) {
          if (typeof p.place === 'number') placePrize.set(p.place, { title: p.title, value: p.value });
        }
        const hasPlacePrizes = placePrize.size > 0;
        for (const entrant of entrants) {
          const rank = entrant.rank;
          const prize = rank != null ? placePrize.get(rank) : undefined;
          const isWinner = rank != null && (prize !== undefined || (!hasPlacePrizes && rank <= 3));
          if (isWinner) {
            const won = prize?.title ? ` and won ${prize.title}${prize.value ? ` (${prize.value})` : ''}` : '';
            createNotification(db, {
              userId: entrant.userId,
              type: 'contest',
              title: '🏆 You won!',
              message: `Congratulations — you placed ${ordinalPlace(rank!)} in "${contestInfo.title}"${won}!`,
              link,
              actorId: userId,
            }).catch(() => {});
          } else if (msg) {
            createNotification(db, {
              userId: entrant.userId, type: 'contest', title: msg.title, message: msg.message, link, actorId: userId,
            }).catch(() => {});
          }
        }
      } else if (msg) {
        for (const entrant of entrants) {
          createNotification(db, {
            userId: entrant.userId, type: 'contest', title: msg.title, message: msg.message, link, actorId: userId,
          }).catch(() => {});
        }
      }

      // Also notify accepted judges on status transitions
      if (newStatus === 'judging' || newStatus === 'completed' || newStatus === 'cancelled') {
        const judges = await db.select({ userId: contestJudges.userId })
          .from(contestJudges)
          .where(and(eq(contestJudges.contestId, contestId), isNotNull(contestJudges.acceptedAt)));

        const judgeMsg = newStatus === 'judging'
          ? { title: 'Judging Period Started', message: `"${contestInfo.title}" is ready for judging.` }
          : (msg ?? { title: 'Contest Update', message: `"${contestInfo.title}" was updated.` });

        for (const judge of judges) {
          // Don't double-notify judges who are also entrants
          if (entrants.some(e => e.userId === judge.userId)) continue;
          createNotification(db, {
            userId: judge.userId,
            type: 'contest',
            title: judgeMsg.title,
            message: judgeMsg.message,
            link,
            actorId: userId,
          }).catch(() => {});
        }
      }
    }
  } catch { /* non-critical */ }

  return { transitioned: true };
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
    })
    .from(contestEntries)
    .innerJoin(contests, eq(contestEntries.contestId, contests.id))
    .where(eq(contestEntries.id, entryId))
    .limit(1);

  if (existing.length === 0) return { withdrawn: false, error: 'Entry not found' };

  const row = existing[0]!;
  if (row.entry.userId !== userId) return { withdrawn: false, error: 'Not the entry owner' };
  if (row.contestStatus !== 'active') {
    return { withdrawn: false, error: 'Can only withdraw from active contests' };
  }

  await db.delete(contestEntries).where(eq(contestEntries.id, entryId));
  await db
    .update(contests)
    .set({ entryCount: sql`GREATEST(${contests.entryCount} - 1, 0)` })
    .where(eq(contests.id, row.entry.contestId));

  return { withdrawn: true };
}

export async function calculateContestRanks(
  db: DB,
  contestId: string,
): Promise<void> {
  // Assign ranks by score with RANK() so tied scores share a rank (1, 1, 3…).
  // Only scored entries are ranked; entries that were never judged keep a null
  // rank rather than being handed an arbitrary trailing position.
  await db.execute(sql`
    UPDATE ${contestEntries}
    SET rank = ranked.rn
    FROM (
      SELECT id, RANK() OVER (ORDER BY score DESC) AS rn
      FROM ${contestEntries}
      WHERE contest_id = ${contestId} AND score IS NOT NULL
    ) AS ranked
    WHERE ${contestEntries}.id = ranked.id
  `);
  // Clear ranks for any entries that have no score (e.g. unjudged).
  await db.execute(sql`
    UPDATE ${contestEntries}
    SET rank = NULL
    WHERE contest_id = ${contestId} AND score IS NULL
  `);
}
