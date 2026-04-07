import { eq, and, desc, sql } from 'drizzle-orm';
import { emitHook } from '../hooks.js';
import {
  hubs,
  hubMembers,
  hubFollowers,
  remoteActors,
  users,
} from '@commonpub/schema';
import type {
  DB,
  HubMemberItem,
  HubRole,
} from '../types.js';
import { hasPermission, canManageRole } from '../utils.js';
import { USER_REF_SELECT, normalizePagination, countRows } from '../query.js';
import { checkBan, validateAndUseInvite } from './moderation.js';
import { createNotification } from '../notification/notification.js';

// --- Membership ---

export async function joinHub(
  db: DB,
  userId: string,
  hubId: string,
  inviteToken?: string,
): Promise<{ joined: boolean; error?: string }> {
  // Check ban
  const ban = await checkBan(db, hubId, userId);
  if (ban) {
    return { joined: false, error: 'You are banned from this hub' };
  }

  // Check join policy
  const hubRow = await db
    .select({ joinPolicy: hubs.joinPolicy })
    .from(hubs)
    .where(eq(hubs.id, hubId))
    .limit(1);

  if (hubRow.length === 0) {
    return { joined: false, error: 'Hub not found' };
  }

  const policy = hubRow[0]!.joinPolicy;

  if (policy !== 'open') {
    if (!inviteToken) {
      return { joined: false, error: 'Invite token required' };
    }
    const tokenResult = await validateAndUseInvite(db, inviteToken);
    if (!tokenResult.valid) {
      return { joined: false, error: 'Invalid or expired invite token' };
    }
    // Verify the invite belongs to this specific hub
    if (tokenResult.hubId !== hubId) {
      return { joined: false, error: 'Invite token is not valid for this hub' };
    }
  }

  const result = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(hubMembers)
      .values({ hubId, userId, role: 'member' })
      .onConflictDoNothing()
      .returning();

    if (inserted.length === 0) {
      return { joined: true, _notify: null };
    }

    await tx
      .update(hubs)
      .set({ memberCount: sql`${hubs.memberCount} + 1` })
      .where(eq(hubs.id, hubId));

    // Collect data for post-transaction notification
    const [hub] = await tx.select({ name: hubs.name, slug: hubs.slug }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
    const [actor] = await tx.select({ displayName: users.displayName, username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
    const admins = await tx.select({ userId: hubMembers.userId }).from(hubMembers)
      .where(and(eq(hubMembers.hubId, hubId), sql`${hubMembers.role} IN ('owner', 'admin')`)).limit(10);

    return {
      joined: true,
      _notify: { hub, actorName: actor?.displayName || actor?.username || 'Someone', admins },
    };
  });

  // Fire notifications AFTER transaction (avoids single-connection deadlock)
  if (result._notify) {
    const { hub, actorName, admins } = result._notify;
    for (const admin of admins) {
      if (admin.userId !== userId) {
        createNotification(db, {
          userId: admin.userId, type: 'hub',
          title: 'New member', message: `${actorName} joined ${hub?.name ?? 'your hub'}`,
          link: hub ? `/hubs/${hub.slug}/members` : undefined, actorId: userId,
        }).catch(() => {});
      }
    }
  }

  if (result.joined) {
    await emitHook('hub:member:joined', { db, hubId, userId, role: 'member' });
  }

  return { joined: result.joined };
}

export async function leaveHub(
  db: DB,
  userId: string,
  hubId: string,
): Promise<{ left: boolean; error?: string }> {
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0) {
    return { left: false, error: 'Not a member' };
  }

  if (member[0]!.role === 'owner') {
    return { left: false, error: 'Owner cannot leave the hub' };
  }

  await db
    .delete(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)));

  await db
    .update(hubs)
    .set({ memberCount: sql`GREATEST(${hubs.memberCount} - 1, 0)` })
    .where(eq(hubs.id, hubId));

  await emitHook('hub:member:left', { db, hubId, userId });

  return { left: true };
}

export async function getMember(
  db: DB,
  hubId: string,
  userId: string,
): Promise<HubMemberItem | null> {
  const rows = await db
    .select({
      member: hubMembers,
      user: USER_REF_SELECT,
    })
    .from(hubMembers)
    .innerJoin(users, eq(hubMembers.userId, users.id))
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
  return {
    hubId: row.member.hubId,
    userId: row.member.userId,
    role: row.member.role,
    joinedAt: row.member.joinedAt,
    user: row.user,
  };
}

export async function listMembers(
  db: DB,
  hubId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: HubMemberItem[]; total: number }> {
  const { limit, offset } = normalizePagination(opts);
  const where = eq(hubMembers.hubId, hubId);

  const [rows, total] = await Promise.all([
    db
      .select({
        member: hubMembers,
        user: USER_REF_SELECT,
      })
      .from(hubMembers)
      .innerJoin(users, eq(hubMembers.userId, users.id))
      .where(where)
      .orderBy(desc(hubMembers.joinedAt))
      .limit(limit)
      .offset(offset),
    countRows(db, hubMembers, where),
  ]);

  const items = rows.map((row) => ({
    hubId: row.member.hubId,
    userId: row.member.userId,
    role: row.member.role,
    joinedAt: row.member.joinedAt,
    user: row.user,
  }));

  return { items, total };
}

export interface RemoteHubMember {
  followerActorUri: string;
  preferredUsername: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  instanceDomain: string;
  joinedAt: Date;
}

/** List remote (federated) followers of a hub from the hubFollowers table */
export async function listRemoteMembers(
  db: DB,
  hubId: string,
): Promise<RemoteHubMember[]> {
  const rows = await db
    .select({
      followerActorUri: hubFollowers.followerActorUri,
      preferredUsername: remoteActors.preferredUsername,
      displayName: remoteActors.displayName,
      avatarUrl: remoteActors.avatarUrl,
      instanceDomain: remoteActors.instanceDomain,
      joinedAt: hubFollowers.createdAt,
    })
    .from(hubFollowers)
    .leftJoin(remoteActors, eq(hubFollowers.followerActorUri, remoteActors.actorUri))
    .where(and(eq(hubFollowers.hubId, hubId), eq(hubFollowers.status, 'accepted')))
    .orderBy(desc(hubFollowers.createdAt));

  return rows.map(r => ({
    followerActorUri: r.followerActorUri,
    preferredUsername: r.preferredUsername,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    instanceDomain: r.instanceDomain ?? 'unknown',
    joinedAt: r.joinedAt,
  }));
}

export async function changeRole(
  db: DB,
  actorId: string,
  hubId: string,
  targetUserId: string,
  newRole: HubRole,
): Promise<{ changed: boolean; error?: string }> {
  const [actorMember, targetMember] = await Promise.all([
    db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(
        and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId)),
      )
      .limit(1),
    db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(
        and(
          eq(hubMembers.hubId, hubId),
          eq(hubMembers.userId, targetUserId),
        ),
      )
      .limit(1),
  ]);

  if (actorMember.length === 0) {
    return { changed: false, error: 'Not a member' };
  }
  if (targetMember.length === 0) {
    return { changed: false, error: 'Target is not a member' };
  }

  if (!hasPermission(actorMember[0]!.role, 'manageMembers')) {
    return { changed: false, error: 'Insufficient permissions' };
  }
  if (!canManageRole(actorMember[0]!.role, targetMember[0]!.role)) {
    return { changed: false, error: 'Cannot manage a user with equal or higher role' };
  }

  if (newRole === 'owner') {
    return { changed: false, error: 'Cannot promote to owner' };
  }

  await db
    .update(hubMembers)
    .set({ role: newRole })
    .where(
      and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId)),
    );

  // Notify affected user (non-critical)
  try {
    const [hub] = await db.select({ name: hubs.name, slug: hubs.slug }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
    await createNotification(db, {
      userId: targetUserId, type: 'hub',
      title: 'Role updated',
      message: `Your role in ${hub?.name ?? 'a hub'} was changed to ${newRole}`,
      link: hub ? `/hubs/${hub.slug}` : undefined, actorId: actorId,
    });
  } catch { /* non-critical */ }

  return { changed: true };
}

export async function kickMember(
  db: DB,
  actorId: string,
  hubId: string,
  targetUserId: string,
): Promise<{ kicked: boolean; error?: string }> {
  const [actorMember, targetMember] = await Promise.all([
    db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(
        and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId)),
      )
      .limit(1),
    db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(
        and(
          eq(hubMembers.hubId, hubId),
          eq(hubMembers.userId, targetUserId),
        ),
      )
      .limit(1),
  ]);

  if (actorMember.length === 0) {
    return { kicked: false, error: 'Not a member' };
  }
  if (targetMember.length === 0) {
    return { kicked: false, error: 'Target is not a member' };
  }
  if (!hasPermission(actorMember[0]!.role, 'kickMember')) {
    return { kicked: false, error: 'Insufficient permissions' };
  }
  if (!canManageRole(actorMember[0]!.role, targetMember[0]!.role)) {
    return { kicked: false, error: 'Cannot kick a user with equal or higher role' };
  }

  await db
    .delete(hubMembers)
    .where(
      and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId)),
    );

  await db
    .update(hubs)
    .set({ memberCount: sql`GREATEST(${hubs.memberCount} - 1, 0)` })
    .where(eq(hubs.id, hubId));

  // Notify kicked user (non-critical)
  try {
    const [hub] = await db.select({ name: hubs.name, slug: hubs.slug }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
    await createNotification(db, {
      userId: targetUserId, type: 'hub',
      title: 'Removed from hub',
      message: `You were removed from ${hub?.name ?? 'a hub'}`,
      link: hub ? `/hubs/${hub.slug}` : undefined, actorId: actorId,
    });
  } catch { /* non-critical */ }

  return { kicked: true };
}
