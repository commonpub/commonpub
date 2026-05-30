import { eq, and } from 'drizzle-orm';
import { contestStakeholders, contests, users } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createNotification } from '../notification/notification.js';

/**
 * Stakeholders are view-only reviewers: they can see a contest (even private /
 * pre-publish) without admin-panel access or being a judge. Distinct from
 * judges — they never appear in the judge list and cannot score.
 */
export interface ContestStakeholderItem {
  id: string;
  contestId: string;
  userId: string;
  invitedAt: Date;
  userName: string;
  userUsername: string;
  userAvatar: string | null;
}

export async function listContestStakeholders(
  db: DB,
  contestId: string,
): Promise<ContestStakeholderItem[]> {
  const rows = await db
    .select({
      sh: contestStakeholders,
      user: { displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl },
    })
    .from(contestStakeholders)
    .innerJoin(users, eq(contestStakeholders.userId, users.id))
    .where(eq(contestStakeholders.contestId, contestId));

  return rows.map(({ sh, user }) => ({
    id: sh.id,
    contestId: sh.contestId,
    userId: sh.userId,
    invitedAt: sh.invitedAt,
    userName: user.displayName ?? user.username,
    userUsername: user.username,
    userAvatar: user.avatarUrl,
  }));
}

export async function addContestStakeholder(
  db: DB,
  contestId: string,
  userId: string,
  context?: { contestSlug: string; contestTitle: string; invitedBy: string },
): Promise<{ added: boolean; error?: string }> {
  const [contest] = await db.select({ id: contests.id }).from(contests).where(eq(contests.id, contestId)).limit(1);
  if (!contest) return { added: false, error: 'Contest not found' };

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { added: false, error: 'User not found' };

  const [existing] = await db
    .select({ id: contestStakeholders.id })
    .from(contestStakeholders)
    .where(and(eq(contestStakeholders.contestId, contestId), eq(contestStakeholders.userId, userId)))
    .limit(1);
  if (existing) return { added: false, error: 'User is already a stakeholder' };

  await db.insert(contestStakeholders).values({ contestId, userId });

  if (context) {
    createNotification(db, {
      userId,
      type: 'contest',
      title: 'Contest Access',
      message: `You've been granted review access to "${context.contestTitle}"`,
      link: `/contests/${context.contestSlug}`,
      actorId: context.invitedBy,
    }).catch(() => {});
  }

  return { added: true };
}

export async function removeContestStakeholder(
  db: DB,
  contestId: string,
  userId: string,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: contestStakeholders.id })
    .from(contestStakeholders)
    .where(and(eq(contestStakeholders.contestId, contestId), eq(contestStakeholders.userId, userId)))
    .limit(1);
  if (!existing) return false;
  await db.delete(contestStakeholders).where(eq(contestStakeholders.id, existing.id));
  return true;
}

export async function isContestStakeholder(
  db: DB,
  contestId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: contestStakeholders.id })
    .from(contestStakeholders)
    .where(and(eq(contestStakeholders.contestId, contestId), eq(contestStakeholders.userId, userId)))
    .limit(1);
  return !!row;
}
