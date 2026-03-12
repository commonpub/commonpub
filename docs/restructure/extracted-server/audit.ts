import { eq, and, desc, sql } from 'drizzle-orm';
import { auditLogs, users } from '@commonpub/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

type DB = NodePgDatabase<Record<string, unknown>>;

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

  const [rows, countResult] = await Promise.all([
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
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(where),
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

  return { items, total: countResult[0]?.count ?? 0 };
}
