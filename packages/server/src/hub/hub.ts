import { eq, and, desc, sql, ilike, isNull } from 'drizzle-orm';
import {
  hubs,
  hubMembers,
  users,
} from '@commonpub/schema';
import type {
  DB,
  HubListItem,
  HubDetail,
  HubFilters,
  HubRole,
  JoinPolicy,
  FederatedHubListItem,
} from '../types.js';
import { generateSlug, hasPermission } from '../utils.js';
import { ensureUniqueSlugFor, USER_REF_SELECT, normalizePagination, countRows, escapeLike } from '../query.js';
import { checkBan } from './moderation.js';

// --- Hub CRUD ---

export async function listHubs(
  db: DB,
  filters: HubFilters = {},
  options?: { includeFederated?: boolean },
): Promise<{ items: (HubListItem | FederatedHubListItem)[]; total: number }> {
  const conditions = [isNull(hubs.deletedAt)];

  if (filters.search) {
    conditions.push(ilike(hubs.name, `%${escapeLike(filters.search)}%`));
  }
  if (filters.joinPolicy) {
    conditions.push(
      eq(hubs.joinPolicy, filters.joinPolicy),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const { limit, offset } = normalizePagination(filters);

  const [rows, total] = await Promise.all([
    db
      .select({
        hub: hubs,
        createdBy: USER_REF_SELECT,
      })
      .from(hubs)
      .innerJoin(users, eq(hubs.createdById, users.id))
      .where(where)
      .orderBy(desc(hubs.createdAt))
      .limit(limit)
      .offset(offset),
    countRows(db, hubs, where),
  ]);

  const localItems: HubListItem[] = rows.map((row) => ({
    id: row.hub.id,
    name: row.hub.name,
    slug: row.hub.slug,
    description: row.hub.description,
    hubType: row.hub.hubType,
    iconUrl: row.hub.iconUrl,
    bannerUrl: row.hub.bannerUrl,
    joinPolicy: row.hub.joinPolicy,
    isOfficial: row.hub.isOfficial,
    memberCount: row.hub.memberCount,
    postCount: row.hub.postCount,
    createdAt: row.hub.createdAt,
    createdBy: row.createdBy,
  }));

  if (!options?.includeFederated) {
    return { items: localItems, total };
  }

  // Try to merge with federated hubs — gracefully degrade if table doesn't exist yet
  try {
    const { listFederatedHubs } = await import('../federation/hubMirroring.js');

    const maxItems = offset + limit;
    const [localAll, fedResult] = await Promise.all([
      offset > 0
        ? db
            .select({ hub: hubs, createdBy: USER_REF_SELECT })
            .from(hubs)
            .innerJoin(users, eq(hubs.createdById, users.id))
            .where(where)
            .orderBy(desc(hubs.createdAt))
            .limit(maxItems)
            .then((r) => r.map((row) => ({
              id: row.hub.id,
              name: row.hub.name,
              slug: row.hub.slug,
              description: row.hub.description,
              hubType: row.hub.hubType,
              iconUrl: row.hub.iconUrl,
              bannerUrl: row.hub.bannerUrl,
              joinPolicy: row.hub.joinPolicy,
              isOfficial: row.hub.isOfficial,
              memberCount: row.hub.memberCount,
              postCount: row.hub.postCount,
              createdAt: row.hub.createdAt,
              createdBy: row.createdBy,
            } as HubListItem)))
        : Promise.resolve(localItems),
      listFederatedHubs(db, { search: filters.search, limit: maxItems }),
    ]);

    const merged: (HubListItem | FederatedHubListItem)[] = [
      ...localAll,
      ...fedResult.items,
    ];

    merged.sort((a, b) => {
      const dateA = 'createdAt' in a ? new Date(a.createdAt).getTime() : new Date((a as FederatedHubListItem).receivedAt).getTime();
      const dateB = 'createdAt' in b ? new Date(b.createdAt).getTime() : new Date((b as FederatedHubListItem).receivedAt).getTime();
      return dateB - dateA;
    });

    return {
      items: merged.slice(offset, offset + limit),
      total: total + fedResult.total,
    };
  } catch {
    // Federated hubs table may not exist yet — return local only
    return { items: localItems, total };
  }
}

export async function getHubBySlug(
  db: DB,
  slug: string,
  requesterId?: string,
): Promise<HubDetail | null> {
  const rows = await db
    .select({
      hub: hubs,
      createdBy: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(hubs)
    .innerJoin(users, eq(hubs.createdById, users.id))
    .where(and(eq(hubs.slug, slug), isNull(hubs.deletedAt)))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
  let currentUserRole: HubRole | null = null;
  let isBanned = false;

  if (requesterId) {
    const [memberRows, banResult] = await Promise.all([
      db
        .select({ role: hubMembers.role })
        .from(hubMembers)
        .where(
          and(
            eq(hubMembers.hubId, row.hub.id),
            eq(hubMembers.userId, requesterId),
          ),
        )
        .limit(1),
      checkBan(db, row.hub.id, requesterId),
    ]);

    currentUserRole = memberRows[0]?.role ?? null;
    isBanned = banResult !== null;
  }

  return {
    id: row.hub.id,
    name: row.hub.name,
    slug: row.hub.slug,
    description: row.hub.description,
    iconUrl: row.hub.iconUrl,
    bannerUrl: row.hub.bannerUrl,
    joinPolicy: row.hub.joinPolicy,
    isOfficial: row.hub.isOfficial,
    memberCount: row.hub.memberCount,
    postCount: row.hub.postCount,
    createdAt: row.hub.createdAt,
    createdBy: row.createdBy,
    rules: row.hub.rules,
    updatedAt: row.hub.updatedAt,
    currentUserRole,
    isBanned,
    hubType: row.hub.hubType,
    privacy: row.hub.privacy,
    website: row.hub.website,
    categories: row.hub.categories,
  };
}

export async function createHub(
  db: DB,
  userId: string,
  input: { name: string; description?: string; rules?: string; joinPolicy?: JoinPolicy },
): Promise<HubDetail> {
  const slug = await ensureUniqueSlugFor(db, hubs, hubs.slug, hubs.id, generateSlug(input.name), 'hub');

  const [inserted] = await db
    .insert(hubs)
    .values({
      name: input.name,
      slug,
      description: input.description ?? null,
      rules: input.rules ?? null,
      joinPolicy: input.joinPolicy ?? 'open',
      createdById: userId,
      memberCount: 1,
    })
    .returning();

  // Auto-add creator as owner
  await db.insert(hubMembers).values({
    hubId: inserted!.id,
    userId,
    role: 'owner',
  });

  return (await getHubBySlug(db, inserted!.slug, userId))!;
}

export async function updateHub(
  db: DB,
  hubId: string,
  userId: string,
  input: {
    name?: string;
    description?: string;
    rules?: string;
    joinPolicy?: string;
    iconUrl?: string;
    bannerUrl?: string;
  },
): Promise<HubDetail | null> {
  // Permission check: must be admin+
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'editHub')) {
    return null;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    updates.name = input.name;
    updates.slug = await ensureUniqueSlugFor(db, hubs, hubs.slug, hubs.id, generateSlug(input.name), 'hub', hubId);
  }
  if (input.description !== undefined) updates.description = input.description;
  if (input.rules !== undefined) updates.rules = input.rules;
  if (input.joinPolicy !== undefined) updates.joinPolicy = input.joinPolicy;
  if (input.iconUrl !== undefined) updates.iconUrl = input.iconUrl;
  if (input.bannerUrl !== undefined) updates.bannerUrl = input.bannerUrl;

  await db.update(hubs).set(updates).where(eq(hubs.id, hubId));

  const slug = (updates.slug as string) ?? undefined;
  if (slug) {
    return getHubBySlug(db, slug, userId);
  }

  // Fetch updated hub
  const current = await db
    .select({ slug: hubs.slug })
    .from(hubs)
    .where(eq(hubs.id, hubId))
    .limit(1);

  return getHubBySlug(db, current[0]!.slug, userId);
}

export async function deleteHub(
  db: DB,
  hubId: string,
  userId: string,
): Promise<boolean> {
  // Owner only
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || member[0]!.role !== 'owner') {
    return false;
  }

  // Soft delete — set deletedAt instead of destroying data
  await db
    .update(hubs)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(hubs.id, hubId));
  return true;
}
