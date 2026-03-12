import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  users,
  contentItems,
  communities,
  communityMembers,
  communityPosts,
  comments,
  likes,
  enrollments,
  learningPaths,
  reports,
  instanceSettings,
} from '@commonpub/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createAuditEntry } from './audit';

type DB = NodePgDatabase<Record<string, unknown>>;

// --- Types ---

export interface PlatformStats {
  users: { total: number; byRole: Record<string, number>; byStatus: Record<string, number> };
  content: { total: number; byType: Record<string, number>; byStatus: Record<string, number> };
  communities: { total: number };
  reports: { pending: number; total: number };
}

export interface UserListItem {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  createdAt: Date;
}

export interface UserFilters {
  search?: string;
  role?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ReportListItem {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: string;
  resolution: string | null;
  createdAt: Date;
  reporter: { id: string; username: string };
  reviewer: { id: string; username: string } | null;
}

export interface ReportFilters {
  status?: string;
  limit?: number;
  offset?: number;
}

// --- Platform Stats ---

export async function getPlatformStats(db: DB): Promise<PlatformStats> {
  const [
    usersByRole,
    usersByStatus,
    contentByType,
    contentByStatus,
    communityCount,
    pendingReports,
    totalReports,
  ] = await Promise.all([
    db
      .select({ role: users.role, count: sql<number>`count(*)::int` })
      .from(users)
      .groupBy(users.role),
    db
      .select({ status: users.status, count: sql<number>`count(*)::int` })
      .from(users)
      .groupBy(users.status),
    db
      .select({ type: contentItems.type, count: sql<number>`count(*)::int` })
      .from(contentItems)
      .groupBy(contentItems.type),
    db
      .select({ status: contentItems.status, count: sql<number>`count(*)::int` })
      .from(contentItems)
      .groupBy(contentItems.status),
    db.select({ count: sql<number>`count(*)::int` }).from(communities),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(eq(reports.status, 'pending')),
    db.select({ count: sql<number>`count(*)::int` }).from(reports),
  ]);

  const byRole: Record<string, number> = {};
  let totalUsers = 0;
  for (const row of usersByRole) {
    byRole[row.role] = row.count;
    totalUsers += row.count;
  }

  const byStatus: Record<string, number> = {};
  for (const row of usersByStatus) {
    byStatus[row.status] = row.count;
  }

  const byType: Record<string, number> = {};
  let totalContent = 0;
  for (const row of contentByType) {
    byType[row.type] = row.count;
    totalContent += row.count;
  }

  const byContentStatus: Record<string, number> = {};
  for (const row of contentByStatus) {
    byContentStatus[row.status] = row.count;
  }

  return {
    users: { total: totalUsers, byRole, byStatus },
    content: { total: totalContent, byType, byStatus: byContentStatus },
    communities: { total: communityCount[0]?.count ?? 0 },
    reports: {
      pending: pendingReports[0]?.count ?? 0,
      total: totalReports[0]?.count ?? 0,
    },
  };
}

// --- User Management ---

export async function listUsers(
  db: DB,
  filters: UserFilters = {},
): Promise<{ items: UserListItem[]; total: number }> {
  const conditions = [];

  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(sql`(${ilike(users.username, term)} OR ${ilike(users.email, term)})`);
  }
  if (filters.role) {
    conditions.push(
      eq(users.role, filters.role as 'member' | 'pro' | 'verified' | 'staff' | 'admin'),
    );
  }
  if (filters.status) {
    conditions.push(eq(users.status, filters.status as 'active' | 'suspended' | 'deleted'));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(where),
  ]);

  return {
    items: rows as UserListItem[],
    total: countResult[0]?.count ?? 0,
  };
}

export async function updateUserRole(
  db: DB,
  userId: string,
  newRole: string,
  adminId: string,
  ip?: string,
): Promise<void> {
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (!user) throw new Error('User not found');

  await db
    .update(users)
    .set({
      role: newRole as 'member' | 'pro' | 'verified' | 'staff' | 'admin',
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await createAuditEntry(db, {
    userId: adminId,
    action: 'user.role_changed',
    targetType: 'user',
    targetId: userId,
    metadata: { previousRole: user.role, newRole },
    ipAddress: ip,
  });
}

export async function updateUserStatus(
  db: DB,
  userId: string,
  newStatus: string,
  adminId: string,
  ip?: string,
): Promise<void> {
  const [user] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId));
  if (!user) throw new Error('User not found');

  await db
    .update(users)
    .set({ status: newStatus as 'active' | 'suspended' | 'deleted', updatedAt: new Date() })
    .where(eq(users.id, userId));

  await createAuditEntry(db, {
    userId: adminId,
    action: 'user.status_changed',
    targetType: 'user',
    targetId: userId,
    metadata: { previousStatus: user.status, newStatus },
    ipAddress: ip,
  });
}

// --- Reports ---

export async function listReports(
  db: DB,
  filters: ReportFilters = {},
): Promise<{ items: ReportListItem[]; total: number }> {
  const conditions = [];

  if (filters.status) {
    conditions.push(
      eq(reports.status, filters.status as 'pending' | 'reviewed' | 'resolved' | 'dismissed'),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const reviewerAlias = alias(users, 'reviewer');

  const [rows, countResult] = await Promise.all([
    db
      .select({
        report: reports,
        reporter: {
          id: users.id,
          username: users.username,
        },
        reviewer: {
          id: reviewerAlias.id,
          username: reviewerAlias.username,
        },
      })
      .from(reports)
      .innerJoin(users, eq(reports.reporterId, users.id))
      .leftJoin(reviewerAlias, eq(reports.reviewedById, reviewerAlias.id))
      .where(where)
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(where),
  ]);

  const items: ReportListItem[] = rows.map((row) => ({
    id: row.report.id,
    targetType: row.report.targetType,
    targetId: row.report.targetId,
    reason: row.report.reason,
    description: row.report.description,
    status: row.report.status,
    resolution: row.report.resolution,
    createdAt: row.report.createdAt,
    reporter: { id: row.reporter.id, username: row.reporter.username },
    reviewer: row.reviewer?.id ? { id: row.reviewer.id, username: row.reviewer.username } : null,
  }));

  return { items, total: countResult[0]?.count ?? 0 };
}

export async function resolveReport(
  db: DB,
  reportId: string,
  resolution: string,
  status: 'resolved' | 'dismissed',
  adminId: string,
  ip?: string,
): Promise<void> {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId));
  if (!report) throw new Error('Report not found');

  await db
    .update(reports)
    .set({
      status,
      resolution,
      reviewedById: adminId,
      reviewedAt: new Date(),
    })
    .where(eq(reports.id, reportId));

  await createAuditEntry(db, {
    userId: adminId,
    action: `report.${status}`,
    targetType: 'report',
    targetId: reportId,
    metadata: { reason: report.reason, targetType: report.targetType, targetId: report.targetId },
    ipAddress: ip,
  });
}

// --- Instance Settings ---

export async function getInstanceSettings(db: DB): Promise<Map<string, unknown>> {
  const rows = await db.select().from(instanceSettings);
  const map = new Map<string, unknown>();
  for (const row of rows) {
    map.set(row.key, row.value);
  }
  return map;
}

export async function getInstanceSetting(db: DB, key: string): Promise<unknown | null> {
  const [row] = await db.select().from(instanceSettings).where(eq(instanceSettings.key, key));
  return row?.value ?? null;
}

export async function setInstanceSetting(
  db: DB,
  key: string,
  value: unknown,
  adminId: string,
  ip?: string,
): Promise<void> {
  const existing = await db.select().from(instanceSettings).where(eq(instanceSettings.key, key));

  if (existing.length > 0) {
    await db
      .update(instanceSettings)
      .set({ value, updatedBy: adminId, updatedAt: new Date() })
      .where(eq(instanceSettings.key, key));
  } else {
    await db.insert(instanceSettings).values({
      key,
      value,
      updatedBy: adminId,
      updatedAt: new Date(),
    });
  }

  await createAuditEntry(db, {
    userId: adminId,
    action: 'setting.updated',
    targetType: 'instance_setting',
    targetId: key,
    metadata: { value },
    ipAddress: ip,
  });
}

// --- Content Moderation ---

export async function deleteUser(
  db: DB,
  userId: string,
  adminId: string,
  ip?: string,
): Promise<void> {
  const [user] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new Error('User not found');

  await db.transaction(async (tx) => {
    // Count and decrement likes on content items
    const userLikes = await tx
      .select({ targetType: likes.targetType, targetId: likes.targetId })
      .from(likes)
      .where(eq(likes.userId, userId));

    for (const like of userLikes) {
      switch (like.targetType) {
        case 'comment':
          await tx
            .update(comments)
            .set({ likeCount: sql`GREATEST(${comments.likeCount} - 1, 0)` })
            .where(eq(comments.id, like.targetId));
          break;
        case 'post':
          await tx
            .update(communityPosts)
            .set({ likeCount: sql`GREATEST(${communityPosts.likeCount} - 1, 0)` })
            .where(eq(communityPosts.id, like.targetId));
          break;
        default:
          await tx
            .update(contentItems)
            .set({ likeCount: sql`GREATEST(${contentItems.likeCount} - 1, 0)` })
            .where(eq(contentItems.id, like.targetId));
          break;
      }
    }

    // Count and decrement comment counts
    const userComments = await tx
      .select({ targetType: comments.targetType, targetId: comments.targetId })
      .from(comments)
      .where(eq(comments.authorId, userId));

    for (const comment of userComments) {
      if (comment.targetType === 'post') {
        await tx
          .update(communityPosts)
          .set({ replyCount: sql`GREATEST(${communityPosts.replyCount} - 1, 0)` })
          .where(eq(communityPosts.id, comment.targetId));
      } else {
        await tx
          .update(contentItems)
          .set({ commentCount: sql`GREATEST(${contentItems.commentCount} - 1, 0)` })
          .where(eq(contentItems.id, comment.targetId));
      }
    }

    // Decrement community member counts
    const memberships = await tx
      .select({ communityId: communityMembers.communityId })
      .from(communityMembers)
      .where(eq(communityMembers.userId, userId));

    for (const m of memberships) {
      await tx
        .update(communities)
        .set({ memberCount: sql`GREATEST(${communities.memberCount} - 1, 0)` })
        .where(eq(communities.id, m.communityId));
    }

    // Decrement enrollment counts
    const userEnrollments = await tx
      .select({ pathId: enrollments.pathId })
      .from(enrollments)
      .where(eq(enrollments.userId, userId));

    for (const e of userEnrollments) {
      await tx
        .update(learningPaths)
        .set({ enrollmentCount: sql`GREATEST(${learningPaths.enrollmentCount} - 1, 0)` })
        .where(eq(learningPaths.id, e.pathId));
    }

    // Delete user (CASCADE handles the actual row deletions)
    await tx.delete(users).where(eq(users.id, userId));
  });

  await createAuditEntry(db, {
    userId: adminId,
    action: 'user.deleted',
    targetType: 'user',
    targetId: userId,
    metadata: { username: user.username },
    ipAddress: ip,
  });
}

export async function removeContent(
  db: DB,
  contentId: string,
  adminId: string,
  ip?: string,
): Promise<void> {
  const [item] = await db
    .select({ id: contentItems.id, title: contentItems.title, authorId: contentItems.authorId })
    .from(contentItems)
    .where(eq(contentItems.id, contentId));
  if (!item) throw new Error('Content not found');

  await db.update(contentItems).set({ status: 'archived' }).where(eq(contentItems.id, contentId));

  await createAuditEntry(db, {
    userId: adminId,
    action: 'content.removed',
    targetType: 'content',
    targetId: contentId,
    metadata: { title: item.title, authorId: item.authorId },
    ipAddress: ip,
  });
}
