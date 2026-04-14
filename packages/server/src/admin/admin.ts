import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { normalizePagination, countRows, escapeLike } from '../query.js';
import {
  users,
  sessions,
  contentItems,
  hubs,
  hubMembers,
  hubPosts,
  comments,
  likes,
  enrollments,
  learningPaths,
  reports,
  instanceSettings,
  auditLogs,
  federatedContent,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import type { AdminUpdateRoleInput, AdminUpdateStatusInput } from '@commonpub/schema';

// --- Audit Types ---

export interface AuditEntry {
  userId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: Date;
  user: {
    id: string;
    username: string;
    displayName: string | null;
  };
}

export interface AuditFilters {
  action?: string;
  userId?: string;
  targetType?: string;
  limit?: number;
  offset?: number;
}

// --- Admin Types ---

export interface PlatformStats {
  users: { total: number; byRole: Record<string, number>; byStatus: Record<string, number> };
  content: { total: number; byType: Record<string, number>; byStatus: Record<string, number> };
  hubs: { total: number };
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
  role?: AdminUpdateRoleInput['role'];
  status?: AdminUpdateStatusInput['status'];
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
  status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  limit?: number;
  offset?: number;
}

// --- Audit Log ---

export async function createAuditEntry(db: DB, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    userId: entry.userId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata ?? null,
    ipAddress: entry.ipAddress ?? null,
  });
}

export async function listAuditLogs(
  db: DB,
  filters: AuditFilters = {},
): Promise<{ items: AuditLogItem[]; total: number }> {
  const conditions = [];

  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action));
  }
  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }
  if (filters.targetType) {
    conditions.push(eq(auditLogs.targetType, filters.targetType));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = Math.min(filters.limit ?? 50, 100);
  const offset = filters.offset ?? 0;

  const [rows, total] = await Promise.all([
    db
      .select({
        log: auditLogs,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        },
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.userId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    countRows(db, auditLogs, where),
  ]);

  const items: AuditLogItem[] = rows.map((row) => ({
    id: row.log.id,
    action: row.log.action,
    targetType: row.log.targetType,
    targetId: row.log.targetId,
    metadata: row.log.metadata,
    ipAddress: row.log.ipAddress,
    createdAt: row.log.createdAt,
    user: {
      id: row.user.id,
      username: row.user.username,
      displayName: row.user.displayName,
    },
  }));

  return { items, total };
}

// --- Platform Stats ---

export async function getPlatformStats(db: DB): Promise<PlatformStats> {
  const [
    usersByRole,
    usersByStatus,
    contentByType,
    contentByStatus,
    hubCount,
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
    db.select({ count: sql<number>`count(*)::int` }).from(hubs),
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
    hubs: { total: hubCount[0]?.count ?? 0 },
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
    const term = `%${escapeLike(filters.search)}%`;
    conditions.push(sql`(${ilike(users.username, term)} OR ${ilike(users.email, term)})`);
  }
  if (filters.role) {
    conditions.push(
      eq(users.role, filters.role),
    );
  }
  if (filters.status) {
    conditions.push(eq(users.status, filters.status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const { limit, offset } = normalizePagination(filters);

  const [rows, total] = await Promise.all([
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
    countRows(db, users, where),
  ]);

  return {
    items: rows as UserListItem[],
    total,
  };
}

export async function updateUserRole(
  db: DB,
  userId: string,
  newRole: AdminUpdateRoleInput['role'],
  adminId: string,
  ip?: string,
): Promise<void> {
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (!user) throw new Error('User not found');

  await db
    .update(users)
    .set({
      role: newRole,
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
  newStatus: AdminUpdateStatusInput['status'],
  adminId: string,
  ip?: string,
): Promise<void> {
  const [user] = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new Error('User not found');

  await db
    .update(users)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Invalidate all sessions when suspending or deleting a user
  if (newStatus === 'suspended' || newStatus === 'deleted') {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

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
      eq(reports.status, filters.status),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const { limit, offset } = normalizePagination(filters);

  const reviewerAlias = alias(users, 'reviewer');

  const [rows, total] = await Promise.all([
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
    countRows(db, reports, where),
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

  return { items, total };
}

export async function resolveReport(
  db: DB,
  reportId: string,
  resolution: string,
  status: 'reviewed' | 'resolved' | 'dismissed',
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
    metadata: {
      reason: report.reason,
      targetType: report.targetType,
      targetId: report.targetId,
    },
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
  const [row] = await db
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, key));
  return row?.value ?? null;
}

export async function setInstanceSetting(
  db: DB,
  key: string,
  value: unknown,
  adminId: string,
  ip?: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, key));

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
            .update(hubPosts)
            .set({ likeCount: sql`GREATEST(${hubPosts.likeCount} - 1, 0)` })
            .where(eq(hubPosts.id, like.targetId));
          break;
        default:
          await tx
            .update(contentItems)
            .set({ likeCount: sql`GREATEST(${contentItems.likeCount} - 1, 0)` })
            .where(eq(contentItems.id, like.targetId));
          break;
      }
    }

    const userComments = await tx
      .select({ targetType: comments.targetType, targetId: comments.targetId })
      .from(comments)
      .where(eq(comments.authorId, userId));

    for (const comment of userComments) {
      if (comment.targetType === 'post') {
        await tx
          .update(hubPosts)
          .set({ replyCount: sql`GREATEST(${hubPosts.replyCount} - 1, 0)` })
          .where(eq(hubPosts.id, comment.targetId));
      } else {
        await tx
          .update(contentItems)
          .set({ commentCount: sql`GREATEST(${contentItems.commentCount} - 1, 0)` })
          .where(eq(contentItems.id, comment.targetId));
      }
    }

    const memberships = await tx
      .select({ hubId: hubMembers.hubId })
      .from(hubMembers)
      .where(eq(hubMembers.userId, userId));

    for (const m of memberships) {
      await tx
        .update(hubs)
        .set({ memberCount: sql`GREATEST(${hubs.memberCount} - 1, 0)` })
        .where(eq(hubs.id, m.hubId));
    }

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
    .select({
      id: contentItems.id,
      title: contentItems.title,
      authorId: contentItems.authorId,
    })
    .from(contentItems)
    .where(eq(contentItems.id, contentId));
  if (!item) throw new Error('Content not found');

  await db
    .update(contentItems)
    .set({ status: 'archived' })
    .where(eq(contentItems.id, contentId));

  await createAuditEntry(db, {
    userId: adminId,
    action: 'content.removed',
    targetType: 'content',
    targetId: contentId,
    metadata: { title: item.title, authorId: item.authorId },
    ipAddress: ip,
  });
}

export async function removeFederatedContent(
  db: DB,
  federatedContentId: string,
  adminId: string,
  ip?: string,
): Promise<void> {
  const [item] = await db
    .select({ id: federatedContent.id, title: federatedContent.title })
    .from(federatedContent)
    .where(eq(federatedContent.id, federatedContentId));
  if (!item) throw new Error('Federated content not found');

  await db
    .update(federatedContent)
    .set({ deletedAt: new Date(), isHidden: true })
    .where(eq(federatedContent.id, federatedContentId));

  await createAuditEntry(db, {
    userId: adminId,
    action: 'content.removed',
    targetType: 'federated_content',
    targetId: federatedContentId,
    metadata: { title: item.title },
    ipAddress: ip,
  });
}
