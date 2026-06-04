import { eq, ne, and, or, desc, sql, isNotNull, inArray } from 'drizzle-orm';
import { contests, contestEntries, contestJudges, contestStakeholders, users, contentItems } from '@commonpub/schema';
import type { DB } from '../types.js';
import { normalizePagination, countRows } from '../query.js';
import { isContestStakeholder } from './stakeholders.js';
import { isContestJudge } from './judges.js';

import type { ContestStatus, ContestStage } from '@commonpub/schema';

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
  /**
   * The review stage this score was given in (Phase B2.5 per-round isolation). A
   * judge has one score per round; the entry's live `score` aggregates only the
   * CURRENT round. Absent on pre-B2.5 scores (treated as a single bucket).
   */
  roundId?: string;
}

export interface ContestListItem {
  id: string;
  title: string;
  slug: string;
  subheading: string | null;
  description: string | null;
  bannerUrl: string | null;
  coverImageUrl: string | null;
  status: ContestStatus;
  startDate: Date;
  endDate: Date;
  entryCount: number;
  createdAt: Date;
}

export interface ContestDetail extends ContestListItem {
  subheading: string | null;
  rules: string | null;
  prizesDescription: string | null;
  showPrizes: boolean;
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
  /** Phase B1 — explicit stage timeline (`[]` ⇒ classic synthesized flow). */
  stages: ContestStage[];
  currentStageId: string | null;
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
  prizesDescription?: string;
  showPrizes?: boolean;
  bannerUrl?: string;
  coverImageUrl?: string;
  prizes?: ContestPrize[];
  judgingCriteria?: ContestJudgingCriterion[];
  stages?: ContestStage[];
  currentStageId?: string;
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

// --- Phase B1: stage timeline helpers (pure — operate on a contest-like object) ---

type StageSource = {
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  judgingEndDate: Date | string | null;
  stages?: ContestStage[] | null;
  currentStageId?: string | null;
};

const toIso = (d: Date | string | null | undefined): string | undefined =>
  d ? new Date(d).toISOString() : undefined;

/**
 * The classic Submissions → Judging → Results timeline, synthesized from the
 * status + date columns for contests that haven't defined explicit stages.
 * Stable ids let `currentStageId` reference them even for legacy contests.
 */
export function synthesizeStages(c: StageSource): ContestStage[] {
  return [
    { id: 'core-submission', name: 'Submissions', kind: 'submission', core: true, startsAt: toIso(c.startDate), endsAt: toIso(c.endDate) },
    { id: 'core-review', name: 'Judging', kind: 'review', core: true, endsAt: toIso(c.judgingEndDate) ?? toIso(c.endDate) },
    { id: 'core-results', name: 'Results', kind: 'results', core: true },
  ];
}

/**
 * The contest's stage timeline: its explicit `stages` if any are defined,
 * otherwise the synthesized classic flow. The standard flow is the zero-config
 * default — a contest with no `stages` renders identically to pre-B1.
 */
export function normalizeStages(c: StageSource): ContestStage[] {
  return c.stages && c.stages.length > 0 ? c.stages : synthesizeStages(c);
}

/**
 * The stage that is currently "now": the one `currentStageId` points at (if it
 * resolves), else derived from the coarse `status`. Null while draft/cancelled
 * (nothing is running). `status` remains the behavioural source of truth for
 * gating; this is for DISPLAY (hero pill, sidebar highlight, countdown label).
 */
export function currentStage(c: StageSource): ContestStage | null {
  const stages = normalizeStages(c);
  if (c.currentStageId) {
    const found = stages.find((s) => s.id === c.currentStageId);
    if (found) return found;
  }
  switch (c.status) {
    case 'draft':
    case 'cancelled':
      return null;
    case 'completed':
      return stages.find((s) => s.kind === 'results') ?? stages[stages.length - 1] ?? null;
    case 'judging':
      return stages.find((s) => s.kind === 'review') ?? null;
    default: // upcoming | active | paused
      return stages.find((s) => s.kind === 'submission') ?? stages[0] ?? null;
  }
}

export interface ContestEntryItem {
  id: string;
  contestId: string;
  contentId: string;
  userId: string;
  score: number | null;
  rank: number | null;
  /** Phase B2 — per-stage cohort outcome; `eliminated` is the derived convenience. */
  stageState: Array<{ stageId: string; status: 'advanced' | 'eliminated'; score?: number | null; rank?: number | null }>;
  eliminated: boolean;
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
      .orderBy(desc(contests.startDate))
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
    coverImageUrl: row.coverImageUrl,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    entryCount: row.entryCount,
    createdAt: row.createdAt,
    subheading: row.subheading,
    rules: row.rules,
    prizesDescription: row.prizesDescription,
    showPrizes: row.showPrizes,
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
      prizesDescription: input.prizesDescription ?? null,
      showPrizes: input.showPrizes ?? true,
      stages: input.stages ?? [],
      // Only keep currentStageId if it references a stage that actually exists.
      currentStageId: input.currentStageId && (input.stages ?? []).some((s) => s.id === input.currentStageId) ? input.currentStageId : null,
      bannerUrl: input.bannerUrl ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
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
  if (data.prizesDescription !== undefined) updates.prizesDescription = data.prizesDescription;
  if (data.bannerUrl !== undefined) updates.bannerUrl = data.bannerUrl;
  if (data.coverImageUrl !== undefined) updates.coverImageUrl = data.coverImageUrl;
  if (data.showPrizes !== undefined) updates.showPrizes = data.showPrizes;
  if (data.stages !== undefined) updates.stages = data.stages;
  if (data.currentStageId !== undefined) updates.currentStageId = data.currentStageId;
  // Keep currentStageId consistent with the stages array: when stages change,
  // drop a pointer that no longer resolves (e.g. reset-to-standard sends stages=[]).
  if (data.stages !== undefined) {
    const desired = data.currentStageId !== undefined ? data.currentStageId : existing[0]!.currentStageId;
    if (!desired || !data.stages.some((s) => s.id === desired)) updates.currentStageId = null;
  }
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

  // Editable slug: when changed, ensure it isn't taken by another contest. The
  // old URL stops resolving (no redirect) — the caller navigates to the new slug.
  let finalSlug = slug;
  if (data.slug !== undefined && data.slug && data.slug !== existing[0]!.slug) {
    const taken = await db.select({ id: contests.id }).from(contests).where(eq(contests.slug, data.slug)).limit(1);
    if (taken.length && taken[0]!.id !== existing[0]!.id) throw new Error('SLUG_TAKEN');
    updates.slug = data.slug;
    finalSlug = data.slug;
  }

  await db.update(contests).set(updates).where(eq(contests.slug, slug));

  return getContestBySlug(db, finalSlug);
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
      stageState: row.entry.stageState ?? [],
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
      stageState: contestEntries.stageState,
      stages: contests.stages,
      currentStageId: contests.currentStageId,
      startDate: contests.startDate,
      endDate: contests.endDate,
      judgingEndDate: contests.judgingEndDate,
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

  // Cohort gate (Phase B2.5): once a review stage has culled the field, entries
  // that didn't advance are out of later rounds and can't be scored.
  if (isEliminated({ stageState: row.stageState })) {
    return { judged: false, error: 'This entry was not advanced and can no longer be scored' };
  }

  // Per-round isolation: which review round is this score for? The entry's live
  // `score` will aggregate only THIS round's judge scores (a classic contest with
  // no explicit stages resolves to the synthesized `core-review`, so it stays one
  // bucket — unchanged single-round behaviour).
  const roundStage = currentStage({
    status: row.contestStatus,
    startDate: row.startDate,
    endDate: row.endDate,
    judgingEndDate: row.judgingEndDate,
    stages: row.stages,
    currentStageId: row.currentStageId,
  });
  const roundId = roundStage && roundStage.kind === 'review' ? roundStage.id : null;

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
    if (roundId) record.roundId = roundId;

    // A judge has one score per round — match on judge AND round.
    const existingIdx = scores.findIndex((s) => s.judgeId === judgeId && (s.roundId ?? null) === (roundId ?? null));
    if (existingIdx >= 0) scores[existingIdx] = record;
    else scores.push(record);

    // The live aggregate reflects ONLY the current round's scores, so a later
    // judging round doesn't blend with an earlier one. Earlier rounds stay in
    // `judgeScores` (tagged with their roundId) as history.
    const roundScores = roundId ? scores.filter((s) => (s.roundId ?? null) === roundId) : scores;
    const avgScore = roundScores.length
      ? Math.round(roundScores.reduce((sum, s) => sum + s.score, 0) / roundScores.length)
      : 0;

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

// Bidirectional lifecycle: stages can move forward OR back (go-back), a running
// contest can be deactivated to `paused` without cancelling (and resumed), and
// terminal states can be reopened. `draft` = created but not launched.
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['upcoming', 'active', 'cancelled'],
  upcoming: ['draft', 'active', 'cancelled'],
  active: ['upcoming', 'paused', 'judging', 'cancelled'],
  paused: ['active', 'upcoming', 'judging', 'cancelled'],
  judging: ['active', 'paused', 'completed', 'cancelled'],
  completed: ['judging'],
  cancelled: ['draft', 'upcoming'],
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
        paused: { title: 'Contest Paused', message: `"${contestInfo.title}" has been temporarily paused.` },
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

/** True when an entry was culled at some review stage (Phase B2 cohort gate). */
export function isEliminated(entry: { stageState?: Array<{ status: string }> | null }): boolean {
  return !!entry.stageState?.some((s) => s.status === 'eliminated');
}

export interface AdvanceStageInput {
  /** The `review` stage whose advancement cut we're applying. */
  reviewStageId: string;
  mode: 'topN' | 'manual';
  /** topN mode: how many of the eligible cohort advance (ties broken deterministically). */
  topN?: number;
  /** manual mode: explicit entry ids that advance; the rest of the cohort is eliminated. */
  advancedEntryIds?: string[];
}

/**
 * Phase B2 — apply an advancement cut at a review stage: the surviving cohort
 * (entries not already eliminated) is split into advancers + eliminated, the
 * round's score/rank is snapshotted into each entry's `stageState`, and the
 * contest's `currentStageId` moves to the next stage. Idempotent per stage —
 * re-running replaces that stage's `stageState` rows rather than duplicating them.
 * Owner-gated. `topN` ties broken by score → rank → id for determinism.
 */
export async function advanceContestStage(
  db: DB,
  contestId: string,
  userId: string,
  input: AdvanceStageInput,
): Promise<{ advanced: boolean; advancedCount: number; eliminatedCount: number; error?: string }> {
  const fail = (error: string) => ({ advanced: false, advancedCount: 0, eliminatedCount: 0, error });

  const [contest] = await db
    .select({
      createdById: contests.createdById,
      status: contests.status,
      stages: contests.stages,
      currentStageId: contests.currentStageId,
      startDate: contests.startDate,
      endDate: contests.endDate,
      judgingEndDate: contests.judgingEndDate,
    })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (!contest) return fail('Contest not found');
  if (contest.createdById !== userId) return fail('Not the contest owner');

  const stages = normalizeStages(contest);
  const idx = stages.findIndex((s) => s.id === input.reviewStageId);
  if (idx < 0) return fail('Unknown stage');
  if (stages[idx]!.kind !== 'review') return fail('Advancement applies to review stages only');

  const rows = await db
    .select({ id: contestEntries.id, userId: contestEntries.userId, score: contestEntries.score, rank: contestEntries.rank, stageState: contestEntries.stageState })
    .from(contestEntries)
    .where(eq(contestEntries.contestId, contestId));

  // Only the running cohort (not already eliminated) is subject to the cut.
  const eligible = rows.filter((r) => !isEliminated(r));

  let advancedIds: Set<string>;
  if (input.mode === 'manual') {
    const picked = new Set(input.advancedEntryIds ?? []);
    advancedIds = new Set(eligible.filter((e) => picked.has(e.id)).map((e) => e.id));
  } else {
    const n = Math.max(0, input.topN ?? 0);
    const sorted = [...eligible].sort(
      (a, b) =>
        (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
        (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
        a.id.localeCompare(b.id),
    );
    advancedIds = new Set(sorted.slice(0, n).map((e) => e.id));
  }

  let advancedCount = 0;
  let eliminatedCount = 0;
  for (const e of eligible) {
    const isAdv = advancedIds.has(e.id);
    const prior = (e.stageState ?? []).filter((s) => s.stageId !== input.reviewStageId);
    const next = [...prior, { stageId: input.reviewStageId, status: isAdv ? ('advanced' as const) : ('eliminated' as const), score: e.score ?? null, rank: e.rank ?? null }];
    await db.update(contestEntries).set({ stageState: next }).where(eq(contestEntries.id, e.id));
    if (isAdv) advancedCount++;
    else eliminatedCount++;
  }

  const nextStage = stages[idx + 1];
  if (nextStage) {
    await db.update(contests).set({ currentStageId: nextStage.id, updatedAt: new Date() }).where(eq(contests.id, contestId));
  }

  // Notify entrants of the outcome (non-critical, de-duped by user).
  try {
    const { createNotification } = await import('../notification/notification.js');
    const [info] = await db.select({ title: contests.title, slug: contests.slug }).from(contests).where(eq(contests.id, contestId)).limit(1);
    if (info) {
      const nextName = nextStage?.name ?? 'the next stage';
      const seen = new Set<string>();
      for (const e of eligible) {
        if (seen.has(e.userId)) continue;
        seen.add(e.userId);
        const adv = advancedIds.has(e.id);
        createNotification(db, {
          userId: e.userId,
          type: 'contest',
          title: adv ? '✅ You advanced!' : 'Contest update',
          message: adv
            ? `Your entry advanced to ${nextName} in "${info.title}".`
            : `Your entry wasn't selected to continue in "${info.title}".`,
          link: `/contests/${info.slug}`,
          actorId: userId,
        }).catch(() => {});
      }
    }
  } catch {
    /* non-critical */
  }

  return { advanced: true, advancedCount, eliminatedCount };
}
