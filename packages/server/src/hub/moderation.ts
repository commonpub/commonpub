import { eq, and, desc, sql } from 'drizzle-orm';
import {
  hubs,
  hubMembers,
  hubBans,
  hubInvites,
  users,
} from '@commonpub/schema';
import type {
  DB,
  HubBanItem,
  HubInviteItem,
  HubRole,
} from '../types.js';
import { hasPermission, canManageRole } from '../utils.js';
import { USER_REF_SELECT } from '../query.js';
import { createNotification } from '../notification/notification.js';

// --- Bans ---

export async function banUser(
  db: DB,
  actorId: string,
  hubId: string,
  targetUserId: string,
  reason?: string,
  expiresAt?: Date,
): Promise<{ banned: boolean; error?: string }> {
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

  if (actorMember.length === 0 || !hasPermission(actorMember[0]!.role, 'banUser')) {
    return { banned: false, error: 'Insufficient permissions' };
  }

  if (actorMember[0]!.role === 'moderator' && !expiresAt) {
    return { banned: false, error: 'Moderators can only issue temporary bans' };
  }

  if (targetMember.length > 0) {
    if (!canManageRole(actorMember[0]!.role, targetMember[0]!.role)) {
      return { banned: false, error: 'Cannot ban a user with equal or higher role' };
    }

    await db
      .delete(hubMembers)
      .where(
        and(
          eq(hubMembers.hubId, hubId),
          eq(hubMembers.userId, targetUserId),
        ),
      );

    await db
      .update(hubs)
      .set({ memberCount: sql`GREATEST(${hubs.memberCount} - 1, 0)` })
      .where(eq(hubs.id, hubId));
  }

  await db.insert(hubBans).values({
    hubId,
    userId: targetUserId,
    bannedById: actorId,
    reason: reason ?? null,
    expiresAt: expiresAt ?? null,
  }).onConflictDoNothing();

  // Notify banned user (non-critical)
  try {
    const [hub] = await db.select({ name: hubs.name, slug: hubs.slug }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
    const msg = expiresAt
      ? `You were temporarily banned from ${hub?.name ?? 'a hub'}${reason ? `: ${reason}` : ''}`
      : `You were banned from ${hub?.name ?? 'a hub'}${reason ? `: ${reason}` : ''}`;
    await createNotification(db, {
      userId: targetUserId, type: 'system',
      title: 'Banned from hub', message: msg,
      link: hub ? `/hubs/${hub.slug}` : undefined, actorId: actorId,
    });
  } catch { /* non-critical */ }

  return { banned: true };
}

export async function unbanUser(
  db: DB,
  actorId: string,
  hubId: string,
  targetUserId: string,
): Promise<{ unbanned: boolean; error?: string }> {
  const actorMember = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId)))
    .limit(1);

  if (actorMember.length === 0 || !hasPermission(actorMember[0]!.role, 'banUser')) {
    return { unbanned: false, error: 'Insufficient permissions' };
  }

  await db
    .delete(hubBans)
    .where(and(eq(hubBans.hubId, hubId), eq(hubBans.userId, targetUserId)));

  return { unbanned: true };
}

export async function checkBan(
  db: DB,
  hubId: string,
  userId: string,
): Promise<{ id: string; reason: string | null; expiresAt: Date | null } | null> {
  const rows = await db
    .select({
      id: hubBans.id,
      reason: hubBans.reason,
      expiresAt: hubBans.expiresAt,
    })
    .from(hubBans)
    .where(and(eq(hubBans.hubId, hubId), eq(hubBans.userId, userId)))
    .limit(1);

  if (rows.length === 0) return null;

  const ban = rows[0]!;
  if (ban.expiresAt && ban.expiresAt < new Date()) {
    await db.delete(hubBans).where(eq(hubBans.id, ban.id));
    return null;
  }

  return ban;
}

export async function listBans(db: DB, hubId: string, opts: { limit?: number; offset?: number } = {}): Promise<HubBanItem[]> {
  // Alias for the banner user (self-join on users table)
  const bannerUser = {
    bannerId: sql<string>`banner.id`.as('banner_id'),
    bannerUsername: sql<string>`banner.username`.as('banner_username'),
    bannerDisplayName: sql<string | null>`banner.display_name`.as('banner_display_name'),
    bannerAvatarUrl: sql<string | null>`banner.avatar_url`.as('banner_avatar_url'),
  };

  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;

  const rows = await db
    .select({
      ban: hubBans,
      user: USER_REF_SELECT,
      ...bannerUser,
    })
    .from(hubBans)
    .innerJoin(users, eq(hubBans.userId, users.id))
    .innerJoin(sql`users AS banner`, sql`banner.id = ${hubBans.bannedById}`)
    .where(eq(hubBans.hubId, hubId))
    .orderBy(desc(hubBans.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    id: row.ban.id,
    reason: row.ban.reason,
    expiresAt: row.ban.expiresAt,
    createdAt: row.ban.createdAt,
    user: row.user,
    bannedBy: {
      id: row.bannerId,
      username: row.bannerUsername,
      displayName: row.bannerDisplayName,
      avatarUrl: row.bannerAvatarUrl,
    },
  }));
}

// --- Invites ---

export async function createInvite(
  db: DB,
  userId: string,
  hubId: string,
  maxUses?: number,
  expiresAt?: Date,
): Promise<HubInviteItem | null> {
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'manageMembers')) {
    return null;
  }

  const token = crypto.randomUUID().replace(/-/g, '');

  const [invite] = await db
    .insert(hubInvites)
    .values({
      hubId,
      createdById: userId,
      token,
      maxUses: maxUses ?? null,
      expiresAt: expiresAt ?? null,
    })
    .returning();

  const author = await db
    .select(USER_REF_SELECT)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    id: invite!.id,
    token: invite!.token,
    maxUses: invite!.maxUses,
    useCount: 0,
    expiresAt: invite!.expiresAt,
    createdAt: invite!.createdAt,
    createdBy: author[0]!,
  };
}

export async function validateAndUseInvite(
  db: DB,
  token: string,
): Promise<{ valid: boolean; hubId?: string }> {
  const updated = await db
    .update(hubInvites)
    .set({ useCount: sql`${hubInvites.useCount} + 1` })
    .where(
      and(
        eq(hubInvites.token, token),
        sql`(${hubInvites.expiresAt} IS NULL OR ${hubInvites.expiresAt} > NOW())`,
        sql`(${hubInvites.maxUses} IS NULL OR ${hubInvites.useCount} < ${hubInvites.maxUses})`,
      ),
    )
    .returning({ hubId: hubInvites.hubId });

  if (updated.length === 0) return { valid: false };

  return { valid: true, hubId: updated[0]!.hubId };
}

export async function revokeInvite(
  db: DB,
  inviteId: string,
  userId: string,
  hubId: string,
): Promise<boolean> {
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'manageMembers')) {
    return false;
  }

  await db.delete(hubInvites).where(eq(hubInvites.id, inviteId));
  return true;
}

export async function listInvites(db: DB, hubId: string, opts: { limit?: number; offset?: number } = {}): Promise<HubInviteItem[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;

  const rows = await db
    .select({
      invite: hubInvites,
      createdBy: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(hubInvites)
    .innerJoin(users, eq(hubInvites.createdById, users.id))
    .where(eq(hubInvites.hubId, hubId))
    .orderBy(desc(hubInvites.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    id: row.invite.id,
    token: row.invite.token,
    maxUses: row.invite.maxUses,
    useCount: row.invite.useCount,
    expiresAt: row.invite.expiresAt,
    createdAt: row.invite.createdAt,
    createdBy: row.createdBy,
  }));
}
