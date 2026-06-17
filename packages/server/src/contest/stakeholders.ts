import { eq, and } from 'drizzle-orm';
import { contestStakeholders, contests, users } from '@commonpub/schema';
import type { StakeholderRole } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createNotification } from '../notification/notification.js';

/**
 * Per-contest collaborators, distinguished by `role`:
 *   - 'reviewer' — view-only: can see a contest (even private / pre-publish)
 *     without admin-panel access or being a judge. Never appears in the judge
 *     list and cannot score. (Original stakeholder semantics.)
 *   - 'editor' — full edit rights to THIS contest only (no system-wide access).
 *     Recognized by `isContestEditor`, which the edit/advance/transition routes
 *     fold into their canManage decision.
 */
export interface ContestStakeholderItem {
  id: string;
  contestId: string;
  userId: string;
  role: StakeholderRole;
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
    role: (sh.role as StakeholderRole) ?? 'reviewer',
    invitedAt: sh.invitedAt,
    userName: user.displayName ?? user.username,
    userUsername: user.username,
    userAvatar: user.avatarUrl,
  }));
}

/**
 * Grant (or update) a user's per-contest collaborator role. Upserts: if the
 * user is already a stakeholder with a different role, their role is updated
 * (so a reviewer can be promoted to editor) — `updated:true` is returned.
 * Adding/promoting is gated to the contest owner / `contest.manage` at the route
 * (an editor cannot mint more editors).
 */
export async function addContestStakeholder(
  db: DB,
  contestId: string,
  userId: string,
  opts?: {
    role?: StakeholderRole;
    contestSlug?: string;
    contestTitle?: string;
    invitedBy?: string;
  },
): Promise<{ added: boolean; updated?: boolean; error?: string }> {
  const role: StakeholderRole = opts?.role ?? 'reviewer';

  const [contest] = await db.select({ id: contests.id }).from(contests).where(eq(contests.id, contestId)).limit(1);
  if (!contest) return { added: false, error: 'Contest not found' };

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { added: false, error: 'User not found' };

  const [existing] = await db
    .select({ id: contestStakeholders.id, role: contestStakeholders.role })
    .from(contestStakeholders)
    .where(and(eq(contestStakeholders.contestId, contestId), eq(contestStakeholders.userId, userId)))
    .limit(1);

  if (existing) {
    if (existing.role === role) return { added: false, error: 'User already has that role' };
    await db.update(contestStakeholders).set({ role }).where(eq(contestStakeholders.id, existing.id));
    notifyStakeholder(db, userId, role, opts);
    return { added: true, updated: true };
  }

  // Conflict-safe insert: a concurrent double-submit can pass the `existing`
  // check above and race the unique (contestId,userId) constraint — upsert the
  // role instead of 500ing on the violation.
  await db
    .insert(contestStakeholders)
    .values({ contestId, userId, role })
    .onConflictDoUpdate({ target: [contestStakeholders.contestId, contestStakeholders.userId], set: { role } });
  notifyStakeholder(db, userId, role, opts);
  return { added: true };
}

function notifyStakeholder(
  db: DB,
  userId: string,
  role: StakeholderRole,
  opts?: { contestSlug?: string; contestTitle?: string; invitedBy?: string },
): void {
  if (!opts?.contestSlug || !opts.contestTitle || !opts.invitedBy) return;
  const access = role === 'editor' ? 'edit access' : 'review access';
  createNotification(db, {
    userId,
    type: 'contest',
    title: 'Contest Access',
    message: `You've been granted ${access} to "${opts.contestTitle}"`,
    link: `/contests/${opts.contestSlug}`,
    actorId: opts.invitedBy,
  }).catch(() => {});
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

/**
 * True if the user is a stakeholder of ANY role (reviewer or editor) — i.e. may
 * VIEW a private/draft contest. Role-agnostic on purpose.
 */
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

/**
 * True if the user is an `editor` stakeholder of this contest — i.e. holds full
 * edit rights to it (no system-wide access). Folded into the canManage decision
 * on the edit/advance/transition routes alongside owner + `contest.manage`.
 */
export async function isContestEditor(
  db: DB,
  contestId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ role: contestStakeholders.role })
    .from(contestStakeholders)
    .where(and(eq(contestStakeholders.contestId, contestId), eq(contestStakeholders.userId, userId)))
    .limit(1);
  return row?.role === 'editor';
}
