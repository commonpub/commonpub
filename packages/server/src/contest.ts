import { eq, and, desc, sql } from 'drizzle-orm';
import { contests, contestEntries, users, contentItems } from '@commonpub/schema';
import type { DB } from './types.js';

export interface ContestListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  status: string;
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
  status?: string;
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
}

export async function listContests(
  db: DB,
  filters: ContestFilters = {},
): Promise<{ items: ContestListItem[]; total: number }> {
  const conditions = [];

  if (filters.status) {
    conditions.push(
      eq(contests.status, filters.status as 'upcoming' | 'active' | 'judging' | 'completed'),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(contests)
      .where(where)
      .orderBy(desc(contests.startDate))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contests)
      .where(where),
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

  return { items, total: countResult[0]?.count ?? 0 };
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

export async function createContest(
  db: DB,
  input: CreateContestInput,
): Promise<ContestDetail> {
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
  data: Partial<CreateContestInput>,
): Promise<ContestDetail | null> {
  const existing = await db
    .select()
    .from(contests)
    .where(eq(contests.slug, slug))
    .limit(1);

  if (existing.length === 0) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.rules !== undefined) updates.rules = data.rules;
  if (data.bannerUrl !== undefined) updates.bannerUrl = data.bannerUrl;
  if (data.prizes !== undefined) updates.prizes = data.prizes;
  if (data.judges !== undefined) updates.judges = data.judges;
  if (data.startDate !== undefined) updates.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updates.endDate = new Date(data.endDate);

  await db.update(contests).set(updates).where(eq(contests.slug, slug));

  return getContestBySlug(db, data.slug ?? slug);
}

export async function listContestEntries(
  db: DB,
  contestId: string,
): Promise<ContestEntryItem[]> {
  const rows = await db
    .select()
    .from(contestEntries)
    .where(eq(contestEntries.contestId, contestId))
    .orderBy(desc(contestEntries.submittedAt));

  return rows.map((row) => ({
    id: row.id,
    contestId: row.contestId,
    contentId: row.contentId,
    userId: row.userId,
    score: row.score,
    rank: row.rank,
    submittedAt: row.submittedAt,
  }));
}

export async function submitContestEntry(
  db: DB,
  contestId: string,
  contentId: string,
  userId: string,
): Promise<ContestEntryItem> {
  const [row] = await db
    .insert(contestEntries)
    .values({
      contestId,
      contentId,
      userId,
    })
    .returning();

  // Increment entry count
  await db
    .update(contests)
    .set({ entryCount: sql`${contests.entryCount} + 1` })
    .where(eq(contests.id, contestId));

  return {
    id: row!.id,
    contestId: row!.contestId,
    contentId: row!.contentId,
    userId: row!.userId,
    score: row!.score,
    rank: row!.rank,
    submittedAt: row!.submittedAt,
  };
}

export async function judgeContestEntry(
  db: DB,
  entryId: string,
  score: number,
  judgeId: string,
): Promise<void> {
  // Append judge score to the judgeScores array
  const existing = await db
    .select()
    .from(contestEntries)
    .where(eq(contestEntries.id, entryId))
    .limit(1);

  if (existing.length === 0) return;

  const entry = existing[0]!;
  const scores = (entry.judgeScores ?? []) as Array<{ judgeId: string; score: number }>;
  const existingIdx = scores.findIndex((s) => s.judgeId === judgeId);
  if (existingIdx >= 0) {
    scores[existingIdx] = { judgeId, score };
  } else {
    scores.push({ judgeId, score });
  }

  // Calculate average score
  const avgScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);

  await db
    .update(contestEntries)
    .set({ judgeScores: scores, score: avgScore })
    .where(eq(contestEntries.id, entryId));
}
