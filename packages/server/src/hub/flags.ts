import { eq, and, desc, inArray } from 'drizzle-orm';
import {
  hubs,
  hubFlags,
  hubMembers,
  hubShares,
  contentItems,
  users,
} from '@commonpub/schema';
import type { CreateHubFlagInput } from '@commonpub/schema';
import type { DB, UserRef } from '../types.js';
import { hasPermission } from '../utils.js';
import { USER_REF_SELECT } from '../query.js';
import { createNotification } from '../notification/notification.js';

export interface HubFlagItem {
  id: string;
  targetType: 'project' | 'member';
  targetId: string;
  targetLabel: string;
  reason: string | null;
  status: 'open' | 'dismissed' | 'actioned';
  flaggedBy: UserRef;
  createdAt: Date;
}

/** The actor's role in a hub, or null if not a member. */
async function getRole(db: DB, hubId: string, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

/**
 * Steward+ flags a shared project or a hub member for owner/admin review.
 * Advisory only — never removes the target. Re-flagging the same target
 * reopens the flag (upsert) so a dismissed report can be raised again.
 */
export async function createHubFlag(
  db: DB,
  actorId: string,
  hubId: string,
  input: CreateHubFlagInput,
): Promise<{ flagged: boolean; error?: string }> {
  const role = await getRole(db, hubId, actorId);
  if (!role) return { flagged: false, error: 'Not a member of this hub' };

  const perm = input.targetType === 'project' ? 'flagContent' : 'flagMember';
  if (!hasPermission(role, perm)) {
    return { flagged: false, error: 'Insufficient permissions' };
  }

  // Validate the target actually belongs to this hub.
  if (input.targetType === 'project') {
    const [share] = await db
      .select({ id: hubShares.id })
      .from(hubShares)
      .where(and(eq(hubShares.hubId, hubId), eq(hubShares.contentId, input.targetId)))
      .limit(1);
    if (!share) return { flagged: false, error: 'That project is not shared to this hub' };
  } else {
    const [member] = await db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(and(
        eq(hubMembers.hubId, hubId),
        eq(hubMembers.userId, input.targetId),
        eq(hubMembers.status, 'active'),
      ))
      .limit(1);
    if (!member) return { flagged: false, error: 'That user is not a member of this hub' };
    if (member.role === 'owner') return { flagged: false, error: 'The owner cannot be flagged' };
  }

  await db
    .insert(hubFlags)
    .values({
      hubId,
      targetType: input.targetType,
      targetId: input.targetId,
      flaggedById: actorId,
      reason: input.reason ?? null,
      status: 'open',
    })
    .onConflictDoUpdate({
      target: [hubFlags.hubId, hubFlags.targetType, hubFlags.targetId, hubFlags.flaggedById],
      set: { reason: input.reason ?? null, status: 'open', resolvedById: null, resolvedAt: null },
    });

  return { flagged: true };
}

/**
 * The hub's flag queue for review. Owner/admin only. Resolves a human label for
 * each target (project title / member name).
 */
export async function listHubFlags(
  db: DB,
  actorId: string,
  hubId: string,
  filters?: { status?: 'open' | 'dismissed' | 'actioned' },
  opts?: { asPlatformAdmin?: boolean },
): Promise<{ items: HubFlagItem[]; error?: string }> {
  if (!opts?.asPlatformAdmin) {
    const role = await getRole(db, hubId, actorId);
    if (!role || !hasPermission(role, 'reviewFlags')) {
      return { items: [], error: 'Insufficient permissions' };
    }
  }

  const conditions = [eq(hubFlags.hubId, hubId)];
  if (filters?.status) conditions.push(eq(hubFlags.status, filters.status));

  const rows = await db
    .select({ flag: hubFlags, flaggedBy: USER_REF_SELECT })
    .from(hubFlags)
    .innerJoin(users, eq(hubFlags.flaggedById, users.id))
    .where(and(...conditions))
    .orderBy(desc(hubFlags.createdAt));

  // Batch-resolve target labels.
  const projectIds = rows.filter((r) => r.flag.targetType === 'project').map((r) => r.flag.targetId);
  const memberIds = rows.filter((r) => r.flag.targetType === 'member').map((r) => r.flag.targetId);
  const [projectRows, memberRows] = await Promise.all([
    projectIds.length
      ? db.select({ id: contentItems.id, title: contentItems.title }).from(contentItems).where(inArray(contentItems.id, projectIds))
      : Promise.resolve([] as { id: string; title: string }[]),
    memberIds.length
      ? db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(inArray(users.id, memberIds))
      : Promise.resolve([] as { id: string; displayName: string | null; username: string }[]),
  ]);
  const projectLabel = new Map(projectRows.map((p) => [p.id, p.title]));
  const memberLabel = new Map(memberRows.map((m) => [m.id, m.displayName ?? m.username]));

  const items: HubFlagItem[] = rows.map((r) => ({
    id: r.flag.id,
    targetType: r.flag.targetType,
    targetId: r.flag.targetId,
    targetLabel: (r.flag.targetType === 'project' ? projectLabel.get(r.flag.targetId) : memberLabel.get(r.flag.targetId)) ?? 'Unknown',
    reason: r.flag.reason,
    status: r.flag.status,
    flaggedBy: r.flaggedBy,
    createdAt: r.flag.createdAt,
  }));

  return { items };
}

/**
 * Resolve a flag (dismiss or mark actioned). Owner/admin only. Does NOT itself
 * remove the target — the reviewer takes the destructive action separately
 * (unlink project / kick member).
 */
export async function resolveHubFlag(
  db: DB,
  actorId: string,
  hubId: string,
  flagId: string,
  status: 'dismissed' | 'actioned',
  opts?: { asPlatformAdmin?: boolean },
): Promise<{ resolved: boolean; error?: string }> {
  if (!opts?.asPlatformAdmin) {
    const role = await getRole(db, hubId, actorId);
    if (!role || !hasPermission(role, 'reviewFlags')) {
      return { resolved: false, error: 'Insufficient permissions' };
    }
  }

  const [flag] = await db
    .select({ id: hubFlags.id, flaggedById: hubFlags.flaggedById })
    .from(hubFlags)
    .where(and(eq(hubFlags.id, flagId), eq(hubFlags.hubId, hubId)))
    .limit(1);
  if (!flag) return { resolved: false, error: 'Flag not found' };

  await db
    .update(hubFlags)
    .set({ status, resolvedById: actorId, resolvedAt: new Date() })
    .where(eq(hubFlags.id, flagId));

  // Let the reporter know their flag was reviewed (non-critical).
  try {
    const [hub] = await db.select({ name: hubs.name, slug: hubs.slug }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
    await createNotification(db, {
      userId: flag.flaggedById, type: 'hub',
      title: 'Flag reviewed',
      message: `Your flag in ${hub?.name ?? 'a hub'} was ${status}`,
      link: hub ? `/hubs/${hub.slug}` : undefined, actorId,
    });
  } catch { /* non-critical */ }

  return { resolved: true };
}
