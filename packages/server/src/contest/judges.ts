import { eq, and } from 'drizzle-orm';
import { contestJudges, contests, contestEntries, users } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createNotification } from '../notification/notification.js';
import { currentStage } from './stages.js';
import type { JudgeScoreEntry } from './types.js';

export type JudgeRole = 'lead' | 'judge' | 'guest';

export interface ContestJudgeItem {
  id: string;
  contestId: string;
  userId: string;
  role: JudgeRole;
  invitedAt: Date;
  acceptedAt: Date | null;
  userName: string;
  userUsername: string;
  userAvatar: string | null;
}

export async function listContestJudges(
  db: DB,
  contestId: string,
): Promise<ContestJudgeItem[]> {
  const rows = await db
    .select({
      judge: contestJudges,
      user: {
        displayName: users.displayName,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(contestJudges)
    .innerJoin(users, eq(contestJudges.userId, users.id))
    .where(eq(contestJudges.contestId, contestId));

  return rows.map(({ judge, user }) => ({
    id: judge.id,
    contestId: judge.contestId,
    userId: judge.userId,
    role: judge.role,
    invitedAt: judge.invitedAt,
    acceptedAt: judge.acceptedAt,
    userName: user.displayName ?? user.username,
    userUsername: user.username,
    userAvatar: user.avatarUrl,
  }));
}

export async function addContestJudge(
  db: DB,
  contestId: string,
  userId: string,
  role: JudgeRole = 'judge',
  context?: { contestSlug: string; contestTitle: string; invitedBy: string },
): Promise<{ added: boolean; error?: string }> {
  // Verify contest exists
  const [contest] = await db
    .select({ id: contests.id })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (!contest) return { added: false, error: 'Contest not found' };

  // Verify user exists
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { added: false, error: 'User not found' };

  // Race-safe add: rely on the unique (contestId,userId) constraint via
  // onConflictDoNothing instead of a check-then-insert, which could race a
  // concurrent double-invite into a 500. No inserted row ⇒ already a judge.
  const [inserted] = await db
    .insert(contestJudges)
    .values({ contestId, userId, role })
    .onConflictDoNothing()
    .returning({ id: contestJudges.id });

  if (!inserted) return { added: false, error: 'User is already a judge' };

  // Notify the invited judge (non-critical)
  if (context) {
    createNotification(db, {
      userId,
      type: 'contest',
      title: 'Judge Invitation',
      message: `You've been invited to judge "${context.contestTitle}"`,
      link: `/contests/${context.contestSlug}`,
      actorId: context.invitedBy,
    }).catch(() => {});
  }

  return { added: true };
}

export async function removeContestJudge(
  db: DB,
  contestId: string,
  userId: string,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: contestJudges.id })
    .from(contestJudges)
    .where(and(eq(contestJudges.contestId, contestId), eq(contestJudges.userId, userId)))
    .limit(1);

  if (!existing) return false;

  // A judge removed mid-round (a conflict of interest, a wrong invite) must stop
  // deciding the cut. Their scores in the CURRENT review round are dropped and
  // each affected entry's live average recomputed from the remaining judges.
  // Earlier rounds are history: those cuts already ran and are snapshotted.
  await db.transaction(async (tx) => {
    await tx.delete(contestJudges).where(eq(contestJudges.id, existing.id));
    const [c] = await tx
      .select({ status: contests.status, stages: contests.stages, currentStageId: contests.currentStageId, startDate: contests.startDate, endDate: contests.endDate, judgingEndDate: contests.judgingEndDate })
      .from(contests)
      .where(eq(contests.id, contestId))
      .limit(1);
    const round = c ? currentStage(c) : null;
    if (!round || round.kind !== 'review') return;
    const rows = await tx
      .select({ id: contestEntries.id, judgeScores: contestEntries.judgeScores })
      .from(contestEntries)
      .where(eq(contestEntries.contestId, contestId))
      .for('update');
    for (const r of rows) {
      const scores = (r.judgeScores ?? []) as JudgeScoreEntry[];
      const kept = scores.filter((s) => !(s.judgeId === userId && s.roundId === round.id));
      if (kept.length === scores.length) continue;
      const roundScores = kept.filter((s) => s.roundId === round.id);
      const avg = roundScores.length ? Math.round(roundScores.reduce((t, s) => t + s.score, 0) / roundScores.length) : null;
      await tx.update(contestEntries).set({ judgeScores: kept, score: avg }).where(eq(contestEntries.id, r.id));
    }
  });
  return true;
}

export async function updateJudgeRole(
  db: DB,
  contestId: string,
  userId: string,
  role: JudgeRole,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: contestJudges.id })
    .from(contestJudges)
    .where(and(eq(contestJudges.contestId, contestId), eq(contestJudges.userId, userId)))
    .limit(1);

  if (!existing) return false;
  await db.update(contestJudges).set({ role }).where(eq(contestJudges.id, existing.id));
  return true;
}

export async function acceptJudgeInvite(
  db: DB,
  contestId: string,
  userId: string,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: contestJudges.id, acceptedAt: contestJudges.acceptedAt })
    .from(contestJudges)
    .where(and(eq(contestJudges.contestId, contestId), eq(contestJudges.userId, userId)))
    .limit(1);

  if (!existing || existing.acceptedAt) return false;
  await db.update(contestJudges)
    .set({ acceptedAt: new Date() })
    .where(eq(contestJudges.id, existing.id));

  // Notify the contest owner that the judge accepted (non-critical)
  try {
    const [contestInfo] = await db
      .select({ title: contests.title, slug: contests.slug, createdById: contests.createdById })
      .from(contests)
      .where(eq(contests.id, contestId))
      .limit(1);

    const [judgeUser] = await db
      .select({ displayName: users.displayName, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (contestInfo && judgeUser) {
      const name = judgeUser.displayName ?? judgeUser.username;
      createNotification(db, {
        userId: contestInfo.createdById,
        type: 'contest',
        title: 'Judge Accepted',
        message: `${name} accepted the judge invitation for "${contestInfo.title}"`,
        link: `/contests/${contestInfo.slug}`,
        actorId: userId,
      }).catch(() => {});
    }
  } catch { /* non-critical */ }

  return true;
}

/**
 * The viewer's judge record on a contest, or null. Callers that grant READ
 * privileges should require `acceptedAt`: `isContestJudge` matches a pending
 * invitation too, so a wrongly invited person who never accepted could read
 * every judge's scores and feedback (session 260).
 */
export async function getContestJudgeMembership(
  db: DB,
  contestId: string,
  userId: string,
): Promise<{ role: JudgeRole; acceptedAt: Date | null } | null> {
  const [row] = await db
    .select({ role: contestJudges.role, acceptedAt: contestJudges.acceptedAt })
    .from(contestJudges)
    .where(and(eq(contestJudges.contestId, contestId), eq(contestJudges.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function isContestJudge(
  db: DB,
  contestId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: contestJudges.id })
    .from(contestJudges)
    .where(and(eq(contestJudges.contestId, contestId), eq(contestJudges.userId, userId)))
    .limit(1);
  return !!row;
}
