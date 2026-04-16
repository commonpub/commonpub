import { eq, and } from 'drizzle-orm';
import { contestJudges, contests, users } from '@commonpub/schema';
import type { DB } from '../types.js';

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

  // Check if already a judge
  const [existing] = await db
    .select({ id: contestJudges.id })
    .from(contestJudges)
    .where(and(eq(contestJudges.contestId, contestId), eq(contestJudges.userId, userId)))
    .limit(1);

  if (existing) return { added: false, error: 'User is already a judge' };

  await db.insert(contestJudges).values({ contestId, userId, role });
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
  await db.delete(contestJudges).where(eq(contestJudges.id, existing.id));
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
  return true;
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
