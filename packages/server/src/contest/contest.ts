import { eq, and, desc, sql } from 'drizzle-orm';
import { contests, contestEntries, users, contentItems } from '@commonpub/schema';
import type { DB } from '../types.js';
import { normalizePagination, countRows } from '../query.js';

import type { ContestStatus } from '@commonpub/schema';

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
  rules: string | null;
  prizes: Array<{ place: number; title: string; description?: string; value?: string }> | null;
  judgingCriteria: unknown | null;
  judgingEndDate: Date | null;
  judges: string[] | null;
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
  description?: string;
  rules?: string;
  bannerUrl?: string;
  prizes?: Array<{ place: number; title: string; description?: string; value?: string }>;
  judges?: string[];
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
  judgeScores?: Array<{ judgeId: string; score: number; feedback?: string }>;
}

export async function listContests(
  db: DB,
  filters: ContestFilters = {},
): Promise<{ items: ContestListItem[]; total: number }> {
  const conditions = [];

  if (filters.status) {
    conditions.push(
      eq(contests.status, filters.status),
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

  const row = rows[0]!;
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
    rules: row.rules,
    prizes: row.prizes ?? null,
    judgingCriteria: null,
    judgingEndDate: row.judgingEndDate,
    judges: row.judges ?? null,
    createdById: row.createdById,
  };
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
      description: input.description ?? null,
      rules: input.rules ?? null,
      bannerUrl: input.bannerUrl ?? null,
      prizes: input.prizes ?? null,
      judges: input.judges ?? null,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      judgingEndDate: input.judgingEndDate ? new Date(input.judgingEndDate) : null,
      createdById: input.createdBy,
    })
    .returning();

  return {
    id: row!.id,
    title: row!.title,
    slug: row!.slug,
    description: row!.description,
    bannerUrl: row!.bannerUrl,
    status: row!.status,
    startDate: row!.startDate,
    endDate: row!.endDate,
    entryCount: row!.entryCount,
    createdAt: row!.createdAt,
    rules: row!.rules,
    prizes: row!.prizes ?? null,
    judgingCriteria: null,
    judgingEndDate: row!.judgingEndDate,
    judges: row!.judges ?? null,
    createdById: row!.createdById,
  };
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
  if (data.description !== undefined) updates.description = data.description;
  if (data.rules !== undefined) updates.rules = data.rules;
  if (data.bannerUrl !== undefined) updates.bannerUrl = data.bannerUrl;
  if (data.prizes !== undefined) updates.prizes = data.prizes;
  if (data.judges !== undefined) updates.judges = data.judges;
  if (data.startDate !== undefined) updates.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updates.endDate = new Date(data.endDate);
  if (data.judgingEndDate !== undefined) updates.judgingEndDate = data.judgingEndDate ? new Date(data.judgingEndDate) : null;

  await db.update(contests).set(updates).where(eq(contests.slug, slug));

  return getContestBySlug(db, slug);
}

export async function listContestEntries(
  db: DB,
  contestId: string,
  opts: { limit?: number; offset?: number; includeJudgeScores?: boolean } = {},
): Promise<{ items: ContestEntryItem[]; total: number }> {
  const { limit, offset } = normalizePagination(opts);
  const where = eq(contestEntries.contestId, contestId);

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
      .orderBy(desc(contestEntries.submittedAt))
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
      score: row.entry.score,
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
      item.judgeScores = (row.entry.judgeScores ?? []) as Array<{ judgeId: string; score: number; feedback?: string }>;
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
    .select({ id: contests.id, status: contests.status })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (contest.length === 0) return null;
  if (contest[0]!.status !== 'active') return null;

  // Validate content exists, is published, and user owns it
  const content = await db
    .select({ id: contentItems.id, authorId: contentItems.authorId, status: contentItems.status })
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);

  if (content.length === 0) return null;
  if (content[0]!.status !== 'published') return null;
  if (content[0]!.authorId !== userId) return null;

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
  score: number,
  judgeId: string,
  feedback?: string,
): Promise<{ judged: boolean; error?: string }> {
  // Get the entry and its contest
  const existing = await db
    .select({
      entry: contestEntries,
      contestJudges: contests.judges,
      contestStatus: contests.status,
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

  // Check judge authorization
  const judges = (row.contestJudges ?? []) as string[];
  if (!judges.includes(judgeId)) {
    return { judged: false, error: 'Not authorized to judge this contest' };
  }

  const entry = row.entry;
  const scores = (entry.judgeScores ?? []) as Array<{ judgeId: string; score: number; feedback?: string }>;
  const existingIdx = scores.findIndex((s) => s.judgeId === judgeId);
  if (existingIdx >= 0) {
    scores[existingIdx] = { judgeId, score, feedback };
  } else {
    scores.push({ judgeId, score, feedback });
  }

  const avgScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);

  await db
    .update(contestEntries)
    .set({ judgeScores: scores, score: avgScore })
    .where(eq(contestEntries.id, entryId));

  return { judged: true };
}

// --- Contest Management ---

export async function deleteContest(
  db: DB,
  contestId: string,
  userId: string,
): Promise<boolean> {
  const contest = await db
    .select({ createdById: contests.createdById })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (contest.length === 0) return false;
  if (contest[0]!.createdById !== userId) return false;

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
    const [contestInfo] = await db.select({ title: contests.title, slug: contests.slug })
      .from(contests).where(eq(contests.id, contestId)).limit(1);

    if (contestInfo) {
      const entrants = await db.select({ userId: contestEntries.userId })
        .from(contestEntries).where(eq(contestEntries.contestId, contestId));

      const messages: Record<string, { title: string; message: string }> = {
        active: { title: 'Contest Open', message: `"${contestInfo.title}" is now accepting submissions!` },
        judging: { title: 'Judging Started', message: `"${contestInfo.title}" is now being judged.` },
        completed: { title: 'Results Posted', message: `Results for "${contestInfo.title}" are now available!` },
        cancelled: { title: 'Contest Cancelled', message: `"${contestInfo.title}" has been cancelled.` },
      };

      const msg = messages[newStatus];
      if (msg) {
        for (const entrant of entrants) {
          createNotification(db, {
            userId: entrant.userId,
            type: 'contest',
            title: msg.title,
            message: msg.message,
            link: `/contests/${contestInfo.slug}${newStatus === 'completed' ? '/results' : ''}`,
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
  // Single query: assign ranks by score using a window function
  await db.execute(sql`
    UPDATE ${contestEntries}
    SET rank = ranked.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY score DESC NULLS LAST) AS rn
      FROM ${contestEntries}
      WHERE contest_id = ${contestId}
    ) AS ranked
    WHERE ${contestEntries}.id = ranked.id
  `);
}
