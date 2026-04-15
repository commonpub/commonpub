import { eq, and, asc } from 'drizzle-orm';
import { hubResources, hubMembers, users } from '@commonpub/schema';
import type { DB, UserRef } from '../types.js';
import { USER_REF_SELECT } from '../query.js';
import { hasPermission } from '../utils.js';

// --- Types ---

export interface HubResourceItem {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string;
  sortOrder: number;
  addedBy: UserRef;
  createdAt: Date;
  updatedAt: Date;
}

// --- CRUD ---

export async function listHubResources(
  db: DB,
  hubId: string,
): Promise<{ items: HubResourceItem[]; total: number }> {
  const rows = await db
    .select({
      id: hubResources.id,
      title: hubResources.title,
      url: hubResources.url,
      description: hubResources.description,
      category: hubResources.category,
      sortOrder: hubResources.sortOrder,
      createdAt: hubResources.createdAt,
      updatedAt: hubResources.updatedAt,
      addedBy: USER_REF_SELECT,
    })
    .from(hubResources)
    .innerJoin(users, eq(hubResources.addedById, users.id))
    .where(eq(hubResources.hubId, hubId))
    .orderBy(asc(hubResources.sortOrder), asc(hubResources.createdAt));

  return { items: rows, total: rows.length };
}

export async function createHubResource(
  db: DB,
  hubId: string,
  userId: string,
  input: {
    title: string;
    url: string;
    description?: string;
    category?: string;
    sortOrder?: number;
  },
): Promise<HubResourceItem> {
  // Verify user is a hub member (any role)
  const [member] = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (!member) {
    throw new Error('Must be a hub member to add resources');
  }

  // Auto-assign sortOrder if not provided
  let sortOrder = input.sortOrder ?? 0;
  if (input.sortOrder === undefined) {
    const [maxRow] = await db
      .select({ max: hubResources.sortOrder })
      .from(hubResources)
      .where(eq(hubResources.hubId, hubId))
      .orderBy(hubResources.sortOrder)
      .limit(1);
    // Simple: count existing to get next position
    const existing = await db
      .select({ id: hubResources.id })
      .from(hubResources)
      .where(eq(hubResources.hubId, hubId));
    sortOrder = existing.length;
  }

  const [resource] = await db
    .insert(hubResources)
    .values({
      hubId,
      title: input.title,
      url: input.url,
      description: input.description ?? null,
      category: (input.category ?? 'other') as typeof hubResources.category.enumValues[number],
      sortOrder,
      addedById: userId,
    })
    .returning();

  // Re-fetch with user join
  const [item] = await db
    .select({
      id: hubResources.id,
      title: hubResources.title,
      url: hubResources.url,
      description: hubResources.description,
      category: hubResources.category,
      sortOrder: hubResources.sortOrder,
      createdAt: hubResources.createdAt,
      updatedAt: hubResources.updatedAt,
      addedBy: USER_REF_SELECT,
    })
    .from(hubResources)
    .innerJoin(users, eq(hubResources.addedById, users.id))
    .where(eq(hubResources.id, resource!.id))
    .limit(1);

  return item!;
}

export async function updateHubResource(
  db: DB,
  resourceId: string,
  userId: string,
  input: {
    title?: string;
    url?: string;
    description?: string;
    category?: string;
    sortOrder?: number;
  },
): Promise<HubResourceItem> {
  // Fetch the resource
  const [resource] = await db
    .select()
    .from(hubResources)
    .where(eq(hubResources.id, resourceId))
    .limit(1);

  if (!resource) {
    throw new Error('Resource not found');
  }

  // Check permission: must be author or mod+
  const isAuthor = resource.addedById === userId;
  if (!isAuthor) {
    const [member] = await db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(and(eq(hubMembers.hubId, resource.hubId), eq(hubMembers.userId, userId)))
      .limit(1);

    if (!member || !hasPermission(member.role, 'manageResources')) {
      throw new Error('Insufficient permissions');
    }
  }

  // Build partial update
  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.url !== undefined) updates.url = input.url;
  if (input.description !== undefined) updates.description = input.description;
  if (input.category !== undefined) updates.category = input.category;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

  if (Object.keys(updates).length > 0) {
    await db.update(hubResources).set(updates).where(eq(hubResources.id, resourceId));
  }

  // Re-fetch
  const [item] = await db
    .select({
      id: hubResources.id,
      title: hubResources.title,
      url: hubResources.url,
      description: hubResources.description,
      category: hubResources.category,
      sortOrder: hubResources.sortOrder,
      createdAt: hubResources.createdAt,
      updatedAt: hubResources.updatedAt,
      addedBy: USER_REF_SELECT,
    })
    .from(hubResources)
    .innerJoin(users, eq(hubResources.addedById, users.id))
    .where(eq(hubResources.id, resourceId))
    .limit(1);

  return item!;
}

export async function deleteHubResource(
  db: DB,
  resourceId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const [resource] = await db
    .select()
    .from(hubResources)
    .where(eq(hubResources.id, resourceId))
    .limit(1);

  if (!resource) {
    return { success: false, error: 'Resource not found' };
  }

  // Check permission: must be author or mod+
  const isAuthor = resource.addedById === userId;
  if (!isAuthor) {
    const [member] = await db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(and(eq(hubMembers.hubId, resource.hubId), eq(hubMembers.userId, userId)))
      .limit(1);

    if (!member || !hasPermission(member.role, 'manageResources')) {
      return { success: false, error: 'Insufficient permissions' };
    }
  }

  await db.delete(hubResources).where(eq(hubResources.id, resourceId));
  return { success: true };
}

export async function reorderHubResources(
  db: DB,
  hubId: string,
  userId: string,
  ids: string[],
): Promise<{ success: boolean; error?: string }> {
  // Check permission: mod+ only
  const [member] = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (!member || !hasPermission(member.role, 'manageResources')) {
    return { success: false, error: 'Insufficient permissions' };
  }

  // Update sortOrder for each id based on array position
  for (let i = 0; i < ids.length; i++) {
    await db
      .update(hubResources)
      .set({ sortOrder: i })
      .where(and(eq(hubResources.id, ids[i]!), eq(hubResources.hubId, hubId)));
  }

  return { success: true };
}
