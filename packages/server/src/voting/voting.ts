import { eq, and, sql, inArray } from 'drizzle-orm';
import { hubPostVotes, hubPosts, pollOptions, pollVotes, contestEntryVotes, contestEntries, contests } from '@commonpub/schema';
import type { DB } from '../types.js';

export type VoteDirection = 'up' | 'down';

// --- Hub Post Voting ---

export interface VoteResult {
  voted: boolean;
  direction: VoteDirection | null;
  voteScore: number;
}

export async function voteOnPost(
  db: DB,
  postId: string,
  userId: string,
  direction: VoteDirection,
): Promise<VoteResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: hubPostVotes.id, direction: hubPostVotes.direction })
      .from(hubPostVotes)
      .where(and(eq(hubPostVotes.postId, postId), eq(hubPostVotes.userId, userId)))
      .limit(1);

    if (existing) {
      if (existing.direction === direction) {
        // Same direction — remove vote (toggle off)
        await tx.delete(hubPostVotes).where(eq(hubPostVotes.id, existing.id));
        const scoreDelta = direction === 'up' ? -1 : 1;
        const [post] = await tx.update(hubPosts)
          .set({ voteScore: sql`${hubPosts.voteScore} + ${scoreDelta}` })
          .where(eq(hubPosts.id, postId))
          .returning({ voteScore: hubPosts.voteScore });
        return { voted: false, direction: null, voteScore: post?.voteScore ?? 0 };
      } else {
        // Different direction — flip vote (worth 2 points swing)
        await tx.update(hubPostVotes)
          .set({ direction })
          .where(eq(hubPostVotes.id, existing.id));
        const scoreDelta = direction === 'up' ? 2 : -2;
        const [post] = await tx.update(hubPosts)
          .set({ voteScore: sql`${hubPosts.voteScore} + ${scoreDelta}` })
          .where(eq(hubPosts.id, postId))
          .returning({ voteScore: hubPosts.voteScore });
        return { voted: true, direction, voteScore: post?.voteScore ?? 0 };
      }
    }

    // New vote
    await tx.insert(hubPostVotes).values({ postId, userId, direction });
    const scoreDelta = direction === 'up' ? 1 : -1;
    const [post] = await tx.update(hubPosts)
      .set({ voteScore: sql`${hubPosts.voteScore} + ${scoreDelta}` })
      .where(eq(hubPosts.id, postId))
      .returning({ voteScore: hubPosts.voteScore });
    return { voted: true, direction, voteScore: post?.voteScore ?? 0 };
  });
}

export async function getUserPostVote(
  db: DB,
  postId: string,
  userId: string,
): Promise<VoteDirection | null> {
  const [row] = await db
    .select({ direction: hubPostVotes.direction })
    .from(hubPostVotes)
    .where(and(eq(hubPostVotes.postId, postId), eq(hubPostVotes.userId, userId)))
    .limit(1);
  return row?.direction ?? null;
}

// --- Polls ---

export interface PollOptionResult {
  id: string;
  label: string;
  voteCount: number;
  order: number;
}

export async function createPollOptions(
  db: DB,
  postId: string,
  labels: string[],
): Promise<PollOptionResult[]> {
  const values = labels.map((label, i) => ({
    postId,
    label,
    order: i,
  }));
  const rows = await db.insert(pollOptions).values(values).returning();
  return rows.map(r => ({
    id: r.id,
    label: r.label,
    voteCount: r.voteCount,
    order: r.order,
  }));
}

export async function getPollOptions(
  db: DB,
  postId: string,
): Promise<PollOptionResult[]> {
  const rows = await db
    .select()
    .from(pollOptions)
    .where(eq(pollOptions.postId, postId))
    .orderBy(pollOptions.order);
  return rows.map(r => ({
    id: r.id,
    label: r.label,
    voteCount: r.voteCount,
    order: r.order,
  }));
}

export async function voteOnPoll(
  db: DB,
  postId: string,
  optionId: string,
  userId: string,
): Promise<{ voted: boolean; error?: string }> {
  return db.transaction(async (tx) => {
    // Check if already voted on this poll
    const [existing] = await tx
      .select({ id: pollVotes.id })
      .from(pollVotes)
      .where(and(eq(pollVotes.postId, postId), eq(pollVotes.userId, userId)))
      .limit(1);

    if (existing) return { voted: false, error: 'Already voted on this poll' };

    // Verify option belongs to this post
    const [option] = await tx
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .where(and(eq(pollOptions.id, optionId), eq(pollOptions.postId, postId)))
      .limit(1);

    if (!option) return { voted: false, error: 'Invalid option' };

    await tx.insert(pollVotes).values({ optionId, userId, postId });
    await tx.update(pollOptions)
      .set({ voteCount: sql`${pollOptions.voteCount} + 1` })
      .where(eq(pollOptions.id, optionId));

    return { voted: true };
  });
}

export async function getUserPollVote(
  db: DB,
  postId: string,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ optionId: pollVotes.optionId })
    .from(pollVotes)
    .where(and(eq(pollVotes.postId, postId), eq(pollVotes.userId, userId)))
    .limit(1);
  return row?.optionId ?? null;
}

// --- Contest Entry Voting ---

export async function voteOnContestEntry(
  db: DB,
  entryId: string,
  userId: string,
): Promise<{ voted: boolean; error?: string }> {
  // Verify entry exists and contest allows community voting
  const [entry] = await db
    .select({
      id: contestEntries.id,
      contestId: contestEntries.contestId,
    })
    .from(contestEntries)
    .where(eq(contestEntries.id, entryId))
    .limit(1);

  if (!entry) return { voted: false, error: 'Entry not found' };

  const [contest] = await db
    .select({ communityVotingEnabled: contests.communityVotingEnabled, status: contests.status })
    .from(contests)
    .where(eq(contests.id, entry.contestId))
    .limit(1);

  if (!contest) return { voted: false, error: 'Contest not found' };
  if (!contest.communityVotingEnabled) return { voted: false, error: 'Community voting is not enabled' };
  if (contest.status !== 'active' && contest.status !== 'judging') {
    return { voted: false, error: 'Contest is not accepting votes' };
  }

  const [existing] = await db
    .select({ id: contestEntryVotes.id })
    .from(contestEntryVotes)
    .where(and(eq(contestEntryVotes.entryId, entryId), eq(contestEntryVotes.userId, userId)))
    .limit(1);

  if (existing) return { voted: false, error: 'Already voted' };

  await db.insert(contestEntryVotes).values({ entryId, userId });
  return { voted: true };
}

export async function removeContestEntryVote(
  db: DB,
  entryId: string,
  userId: string,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: contestEntryVotes.id })
    .from(contestEntryVotes)
    .where(and(eq(contestEntryVotes.entryId, entryId), eq(contestEntryVotes.userId, userId)))
    .limit(1);

  if (!existing) return false;
  await db.delete(contestEntryVotes).where(eq(contestEntryVotes.id, existing.id));
  return true;
}

export async function getContestEntryVoteCount(
  db: DB,
  entryId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(contestEntryVotes)
    .where(eq(contestEntryVotes.entryId, entryId));
  return row?.count ?? 0;
}

export async function hasVotedOnContestEntry(
  db: DB,
  entryId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: contestEntryVotes.id })
    .from(contestEntryVotes)
    .where(and(eq(contestEntryVotes.entryId, entryId), eq(contestEntryVotes.userId, userId)))
    .limit(1);
  return !!row;
}

export interface ContestEntryVoteInfo {
  entryId: string;
  count: number;
  voted: boolean;
}

/**
 * Batch-fetch vote counts + user vote status for all entries in a contest.
 * If userId is null, `voted` is always false.
 */
export async function getContestEntryVotes(
  db: DB,
  contestId: string,
  userId: string | null,
): Promise<ContestEntryVoteInfo[]> {
  // Get all entry IDs for this contest
  const entryRows = await db
    .select({ id: contestEntries.id })
    .from(contestEntries)
    .where(eq(contestEntries.contestId, contestId));

  if (entryRows.length === 0) return [];

  const entryIds = entryRows.map(r => r.id);

  // Get vote counts per entry
  const counts = await db
    .select({
      entryId: contestEntryVotes.entryId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(contestEntryVotes)
    .where(inArray(contestEntryVotes.entryId, entryIds))
    .groupBy(contestEntryVotes.entryId);

  const countMap = new Map(counts.map(c => [c.entryId, c.count]));

  // Get user's votes if logged in
  let userVoteSet = new Set<string>();
  if (userId) {
    const userVotes = await db
      .select({ entryId: contestEntryVotes.entryId })
      .from(contestEntryVotes)
      .where(and(
        inArray(contestEntryVotes.entryId, entryIds),
        eq(contestEntryVotes.userId, userId),
      ));
    userVoteSet = new Set(userVotes.map(v => v.entryId));
  }

  return entryRows.map(e => ({
    entryId: e.id,
    count: countMap.get(e.id) ?? 0,
    voted: userVoteSet.has(e.id),
  }));
}
