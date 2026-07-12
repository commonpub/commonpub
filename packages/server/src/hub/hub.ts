import { eq, and, desc, sql, ilike, isNull } from 'drizzle-orm';
import {
  hubs,
  hubMembers,
  users,
  instanceSettings,
} from '@commonpub/schema';
import type {
  DB,
  HubListItem,
  HubDetail,
  HubFilters,
  HubRole,
  HubType,
  HubPrivacy,
  JoinPolicy,
  FederatedHubListItem,
} from '../types.js';
import { generateSlug, hasPermission } from '../utils.js';
import { ensureUniqueSlugFor, USER_REF_SELECT, normalizePagination, countRows, escapeLike } from '../query.js';
import { checkBan } from './moderation.js';
import { REDACTED_HUB_ID } from './access.js';

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
      .orderBy(desc(hubs.createdAt), desc(hubs.id))
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

/** instance_settings key holding the operator-chosen featured hub id (a hub uuid). */
export const FEATURED_HUB_SETTING_KEY = 'hubs.featuredId';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The operator-chosen featured hub (rendered as a full-width hero atop the hubs
 * listing), or null if unset / cleared / pointing at a deleted or non-public
 * hub. Reads instance_settings['hubs.featuredId']; a malformed (non-uuid) value
 * returns null rather than letting a bad SQL bind throw. Returns the same
 * HubListItem shape as `listHubs` so the client maps it identically.
 */
export async function getFeaturedHub(db: DB): Promise<HubListItem | null> {
  const [setting] = await db
    .select({ value: instanceSettings.value })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, FEATURED_HUB_SETTING_KEY))
    .limit(1);
  const id = typeof setting?.value === 'string' ? setting.value : null;
  if (!id || !UUID_RE.test(id)) return null;

  const [row] = await db
    .select({ hub: hubs, createdBy: USER_REF_SELECT })
    .from(hubs)
    .innerJoin(users, eq(hubs.createdById, users.id))
    .where(and(eq(hubs.id, id), isNull(hubs.deletedAt), eq(hubs.privacy, 'public')))
    .limit(1);
  if (!row) return null;

  return {
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
  };
}

/**
 * Resolve a hub's raw id/privacy/joinPolicy by slug with NO metadata redaction —
 * for authenticated WRITE / membership flows (join, leave) that need the real id
 * before the requester is a member and that run their own permission checks
 * server-side. Read paths must use `getHubBySlug` + `requireHubReadAccess` instead.
 */
export async function getHubIdBySlug(
  db: DB,
  slug: string,
): Promise<{ id: string; privacy: HubPrivacy; joinPolicy: JoinPolicy } | null> {
  const [row] = await db
    .select({ id: hubs.id, privacy: hubs.privacy, joinPolicy: hubs.joinPolicy })
    .from(hubs)
    .where(and(eq(hubs.slug, slug), isNull(hubs.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getHubBySlug(
  db: DB,
  slug: string,
  requesterId?: string,
  opts?: { asPlatformAdmin?: boolean },
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
  let joinRequestPending = false;
  let isBanned = false;

  if (requesterId) {
    const [memberRows, banResult] = await Promise.all([
      db
        .select({ role: hubMembers.role, status: hubMembers.status })
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

    // A pending join request is NOT membership: currentUserRole stays null so the
    // UI shows a "request pending" affordance rather than a "joined" badge.
    const memberRow = memberRows[0];
    currentUserRole = memberRow?.status === 'active' ? memberRow.role : null;
    joinRequestPending = memberRow?.status === 'pending';
    isBanned = banResult !== null;
  }

  // Private-hub metadata is members-only. Non-members (currentUserRole === null) get a
  // minimal stub: name + privacy preserved, but the sensitive metadata
  // (description/rules/website/icon/banner/categories) nulled out. The "membership
  // required" signal is the combination privacy === 'private' && currentUserRole === null
  // with redacted metadata — callers/UI key off that (no new HubDetail field is added,
  // to keep the shared type stable). Posts and members are already gated separately.
  // A platform admin (opts.asPlatformAdmin) bypasses redaction so admin read/moderation
  // resolves the real hub. The member/admin path below returns the full detail.
  //
  // P-2 (docs/plans/content-privacy-enforcement.md): when a NON-MEMBER requester is
  // identified, the stub returns REDACTED_HUB_ID instead of the real id, so a read
  // handler that forgets `requireHubReadAccess` still can't enumerate the hub's
  // posts/roster/gallery/resources/products by id. A no-requesterId call keeps the real
  // id, preserving the authenticated WRITE / AP callers (join/leave/like/lock/pin/outbox)
  // that resolve the hub by slug without a member context and run their own checks.
  if (row.hub.privacy === 'private' && currentUserRole === null && !opts?.asPlatformAdmin) {
    return {
      id: requesterId ? REDACTED_HUB_ID : row.hub.id,
      name: row.hub.name,
      slug: row.hub.slug,
      description: null,
      iconUrl: null,
      bannerUrl: null,
      joinPolicy: row.hub.joinPolicy,
      isOfficial: row.hub.isOfficial,
      memberCount: row.hub.memberCount,
      postCount: row.hub.postCount,
      createdAt: row.hub.createdAt,
      createdBy: row.createdBy,
      rules: null,
      updatedAt: row.hub.updatedAt,
      currentUserRole: null,
      joinRequestPending,
      isBanned,
      hubType: row.hub.hubType,
      privacy: row.hub.privacy,
      website: null,
      categories: null,
    };
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
    joinRequestPending,
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
  input: {
    name: string;
    description?: string;
    rules?: string;
    hubType?: HubType;
    joinPolicy?: JoinPolicy;
    privacy?: HubPrivacy;
    website?: string;
    iconUrl?: string;
    bannerUrl?: string;
    categories?: string[];
    parentHubId?: string;
  },
): Promise<HubDetail> {
  const slug = await ensureUniqueSlugFor(db, hubs, hubs.slug, hubs.id, generateSlug(input.name), 'hub');

  const [inserted] = await db
    .insert(hubs)
    .values({
      name: input.name,
      slug,
      description: input.description ?? null,
      rules: input.rules ?? null,
      hubType: input.hubType ?? 'community',
      joinPolicy: input.joinPolicy ?? 'open',
      privacy: input.privacy ?? 'public',
      website: input.website ?? null,
      iconUrl: input.iconUrl ?? null,
      bannerUrl: input.bannerUrl ?? null,
      categories: input.categories ?? null,
      parentHubId: input.parentHubId ?? null,
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
    hubType?: HubType;
    joinPolicy?: string;
    privacy?: HubPrivacy;
    website?: string;
    iconUrl?: string;
    bannerUrl?: string;
    categories?: string[];
  },
  options?: {
    /**
     * Platform-admin override (root). When true, the hub-membership check is
     * skipped so an instance admin can edit ANY community's settings (banner,
     * etc.) without being a member. The caller (API route) is responsible for
     * verifying the actor actually holds the instance-wide permission.
     */
    asPlatformAdmin?: boolean;
  },
): Promise<HubDetail | null> {
  // Permission: a hub admin+ OR (root) a platform admin editing any community.
  if (!options?.asPlatformAdmin) {
    const member = await db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
      .limit(1);

    if (member.length === 0 || !hasPermission(member[0]!.role, 'editHub')) {
      return null;
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    updates.name = input.name;
    updates.slug = await ensureUniqueSlugFor(db, hubs, hubs.slug, hubs.id, generateSlug(input.name), 'hub', hubId);
  }
  if (input.description !== undefined) updates.description = input.description;
  if (input.rules !== undefined) updates.rules = input.rules;
  if (input.hubType !== undefined) updates.hubType = input.hubType;
  if (input.joinPolicy !== undefined) updates.joinPolicy = input.joinPolicy;
  if (input.privacy !== undefined) updates.privacy = input.privacy;
  if (input.website !== undefined) updates.website = input.website;
  if (input.iconUrl !== undefined) updates.iconUrl = input.iconUrl;
  if (input.bannerUrl !== undefined) updates.bannerUrl = input.bannerUrl;
  if (input.categories !== undefined) updates.categories = input.categories;

  await db.update(hubs).set(updates).where(eq(hubs.id, hubId));

  // Thread asPlatformAdmin so a platform admin editing a private hub they are not a member
  // of gets the REAL updated detail back (not the redacted non-member stub / REDACTED_HUB_ID).
  const asPlatformAdmin = options?.asPlatformAdmin;
  const slug = (updates.slug as string) ?? undefined;
  if (slug) {
    return getHubBySlug(db, slug, userId, { asPlatformAdmin });
  }

  // Fetch updated hub
  const current = await db
    .select({ slug: hubs.slug })
    .from(hubs)
    .where(eq(hubs.id, hubId))
    .limit(1);

  return getHubBySlug(db, current[0]!.slug, userId, { asPlatformAdmin });
}

export async function deleteHub(
  db: DB,
  hubId: string,
  userId: string,
  opts?: { asPlatformAdmin?: boolean },
): Promise<boolean> {
  // Hub owner OR (root) a platform admin.
  if (!opts?.asPlatformAdmin) {
    const member = await db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
      .limit(1);

    if (member.length === 0 || member[0]!.role !== 'owner') {
      return false;
    }
  }

  // Soft delete — set deletedAt instead of destroying data
  await db
    .update(hubs)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(hubs.id, hubId));
  return true;
}
