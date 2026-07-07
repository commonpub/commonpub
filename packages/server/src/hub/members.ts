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
): Promise<{ joined: boolean; pending?: boolean; error?: string }> {
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

  // 'invite' hubs require a valid token. 'approval' hubs accept a token as a
  // bypass (the inviter vouched); without one, the join becomes a pending request.
  let inviteBypass = false;
  if (policy === 'invite') {
    if (!inviteToken) {
      return { joined: false, error: 'Invite token required' };
    }
    // Scoped to this hub: a token for another hub matches no row, so it is rejected
    // without consuming one of its uses (the hub-match is part of the atomic check).
    const tokenResult = await validateAndUseInvite(db, inviteToken, hubId);
    if (!tokenResult.valid) {
      return { joined: false, error: 'Invalid or expired invite token' };
    }
  } else if (policy === 'approval' && inviteToken) {
    const tokenResult = await validateAndUseInvite(db, inviteToken, hubId);
    if (tokenResult.valid) inviteBypass = true;
    // An invalid token on an approval hub is not an error — fall through to a request.
  }

  // Approval policy without an invite bypass → create a pending join request.
  if (policy === 'approval' && !inviteBypass) {
    return requestToJoinHub(db, userId, hubId);
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

/**
 * Create a pending join request for an approval-gated hub. Inserts a
 * `status:'pending'` member row WITHOUT bumping memberCount (the count tracks
 * active members; the bump happens at approve-time). Idempotent: re-requesting
 * while pending is a no-op; an already-active member short-circuits to joined.
 */
async function requestToJoinHub(
  db: DB,
  userId: string,
  hubId: string,
): Promise<{ joined: boolean; pending?: boolean }> {
  const result = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(hubMembers)
      .values({ hubId, userId, role: 'member', status: 'pending' })
      .onConflictDoNothing()
      .returning();

    if (inserted.length === 0) {
      const [existing] = await tx
        .select({ status: hubMembers.status })
        .from(hubMembers)
        .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
        .limit(1);
      return { alreadyActive: existing?.status === 'active', notify: null };
    }

    const [hub] = await tx.select({ name: hubs.name, slug: hubs.slug }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
    const [actor] = await tx.select({ displayName: users.displayName, username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
    const admins = await tx.select({ userId: hubMembers.userId }).from(hubMembers)
      .where(and(eq(hubMembers.hubId, hubId), sql`${hubMembers.role} IN ('owner', 'admin')`, eq(hubMembers.status, 'active'))).limit(10);

    return { alreadyActive: false, notify: { hub, actorName: actor?.displayName || actor?.username || 'Someone', admins } };
  });

  if (result.notify) {
    const { hub, actorName, admins } = result.notify;
    for (const admin of admins) {
      if (admin.userId !== userId) {
        createNotification(db, {
          userId: admin.userId, type: 'hub',
          title: 'Join request', message: `${actorName} requested to join ${hub?.name ?? 'your hub'}`,
          link: hub ? `/hubs/${hub.slug}/members` : undefined, actorId: userId,
        }).catch(() => {});
      }
    }
  }

  if (result.alreadyActive) return { joined: true };
  return { joined: false, pending: true };
}

/** List pending join requests for a hub (status = 'pending'). */
export async function listJoinRequests(
  db: DB,
  hubId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: HubMemberItem[]; total: number }> {
  const { limit, offset } = normalizePagination(opts);
  const where = and(eq(hubMembers.hubId, hubId), eq(hubMembers.status, 'pending'));

  const [rows, total] = await Promise.all([
    db
      .select({ member: hubMembers, user: USER_REF_SELECT })
      .from(hubMembers)
      .innerJoin(users, eq(hubMembers.userId, users.id))
      .where(where)
      .orderBy(desc(hubMembers.joinedAt), desc(hubMembers.userId))
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

/** Approve a pending join request: flip to active, bump the count, notify the requester. */
export async function approveJoinRequest(
  db: DB,
  actorId: string,
  hubId: string,
  targetUserId: string,
): Promise<{ approved: boolean; error?: string }> {
  const [actor] = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId), eq(hubMembers.status, 'active')))
    .limit(1);
  if (!actor || !hasPermission(actor.role, 'manageMembers')) {
    return { approved: false, error: 'Insufficient permissions' };
  }

  const result = await db.transaction(async (tx) => {
    // Only flips a row that is still pending; the count bump is tied to that flip.
    const updated = await tx
      .update(hubMembers)
      .set({ status: 'active' })
      .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId), eq(hubMembers.status, 'pending')))
      .returning();
    if (updated.length === 0) return { ok: false, hub: null };

    await tx.update(hubs).set({ memberCount: sql`${hubs.memberCount} + 1` }).where(eq(hubs.id, hubId));
    const [hub] = await tx.select({ name: hubs.name, slug: hubs.slug }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
    return { ok: true, hub };
  });

  if (!result.ok) return { approved: false, error: 'No pending request' };

  await emitHook('hub:member:joined', { db, hubId, userId: targetUserId, role: 'member' });
  createNotification(db, {
    userId: targetUserId, type: 'hub',
    title: 'Request approved', message: `Your request to join ${result.hub?.name ?? 'the hub'} was approved`,
    link: result.hub ? `/hubs/${result.hub.slug}` : undefined, actorId: actorId,
  }).catch(() => {});

  return { approved: true };
}

/** Deny a pending join request: delete the pending row, notify the requester. */
export async function denyJoinRequest(
  db: DB,
  actorId: string,
  hubId: string,
  targetUserId: string,
): Promise<{ denied: boolean; error?: string }> {
  const [actor] = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId), eq(hubMembers.status, 'active')))
    .limit(1);
  if (!actor || !hasPermission(actor.role, 'manageMembers')) {
    return { denied: false, error: 'Insufficient permissions' };
  }

  const deleted = await db
    .delete(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId), eq(hubMembers.status, 'pending')))
    .returning({ userId: hubMembers.userId });
  if (deleted.length === 0) return { denied: false, error: 'No pending request' };

  const [hub] = await db.select({ name: hubs.name, slug: hubs.slug }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
  createNotification(db, {
    userId: targetUserId, type: 'hub',
    title: 'Request declined', message: `Your request to join ${hub?.name ?? 'the hub'} was declined`,
    link: hub ? `/hubs/${hub.slug}` : undefined, actorId: actorId,
  }).catch(() => {});

  return { denied: true };
}

export async function leaveHub(
  db: DB,
  userId: string,
  hubId: string,
): Promise<{ left: boolean; error?: string }> {
  const member = await db
    .select({ role: hubMembers.role, status: hubMembers.status })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0) {
    return { left: false, error: 'Not a member' };
  }

  if (member[0]!.role === 'owner' && member[0]!.status === 'active') {
    return { left: false, error: 'Owner cannot leave the hub' };
  }

  // A pending member cancelling their request: drop the row WITHOUT decrementing
  // memberCount (a pending request never incremented it).
  if (member[0]!.status === 'pending') {
    await db
      .delete(hubMembers)
      .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)));
    return { left: true };
  }

  // Atomic: drop the membership row and decrement the denormalized counter together,
  // so a failure between the two can't leave memberCount overcounting (mirrors joinHub).
  await db.transaction(async (tx) => {
    await tx
      .delete(hubMembers)
      .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)));

    await tx
      .update(hubs)
      .set({ memberCount: sql`GREATEST(${hubs.memberCount} - 1, 0)` })
      .where(eq(hubs.id, hubId));
  });

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
    // Active only: a pending join request is not a member for authz/role purposes.
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId), eq(hubMembers.status, 'active')))
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
  // Active only: pending join requests are excluded from the roster + count.
  const where = and(eq(hubMembers.hubId, hubId), eq(hubMembers.status, 'active'));

  const [rows, total] = await Promise.all([
    db
      .select({
        member: hubMembers,
        user: USER_REF_SELECT,
      })
      .from(hubMembers)
      .innerJoin(users, eq(hubMembers.userId, users.id))
      .where(where)
      .orderBy(desc(hubMembers.joinedAt), desc(hubMembers.userId))
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
          eq(hubMembers.status, 'active'),
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
          eq(hubMembers.status, 'active'),
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

/**
 * Transfer hub ownership to another active member. Owner-only. Atomic: the
 * target becomes `owner` and the former owner is demoted to `admin` (kept as a
 * manager, not stranded), preserving the exactly-one-owner invariant. Bypasses
 * `changeRole`'s "cannot promote to owner" guard by being a dedicated,
 * owner-gated path. Both member rows are locked FOR UPDATE to serialize
 * concurrent transfers.
 */
export async function transferOwnership(
  db: DB,
  actorId: string,
  hubId: string,
  targetUserId: string,
): Promise<{ transferred: boolean; error?: string }> {
  if (actorId === targetUserId) {
    return { transferred: false, error: 'You already own this hub' };
  }

  const result = await db.transaction(async (tx) => {
    const [actor] = await tx
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId)))
      .for('update')
      .limit(1);
    if (!actor || actor.role !== 'owner') {
      return { transferred: false, error: 'Only the owner can transfer ownership' } as const;
    }

    const [target] = await tx
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(and(
        eq(hubMembers.hubId, hubId),
        eq(hubMembers.userId, targetUserId),
        eq(hubMembers.status, 'active'),
      ))
      .for('update')
      .limit(1);
    if (!target) {
      return { transferred: false, error: 'Target is not an active member of this hub' } as const;
    }

    await tx.update(hubMembers).set({ role: 'owner' })
      .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId)));
    await tx.update(hubMembers).set({ role: 'admin' })
      .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId)));

    return { transferred: true } as const;
  });

  if (result.transferred) {
    try {
      const [hub] = await db.select({ name: hubs.name, slug: hubs.slug }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
      await createNotification(db, {
        userId: targetUserId, type: 'hub',
        title: 'You are now the owner',
        message: `You were made the owner of ${hub?.name ?? 'a hub'}`,
        link: hub ? `/hubs/${hub.slug}` : undefined, actorId,
      });
    } catch { /* non-critical */ }
  }

  return result;
}
