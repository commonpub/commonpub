import { eq, and } from 'drizzle-orm';
import { contentItems } from '@commonpub/schema';
import type { DB } from './types.js';

/** Generate a URL-safe slug from a string */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/** Ensure a slug is unique among content items, appending a timestamp suffix if needed */
export async function ensureUniqueSlug(
  db: DB,
  slug: string,
  excludeId?: string,
): Promise<string> {
  if (!slug) {
    slug = `untitled-${Date.now()}`;
  }

  const conditions = [eq(contentItems.slug, slug)];
  if (excludeId) {
    const { ne } = await import('drizzle-orm');
    conditions.push(ne(contentItems.id, excludeId));
  }

  const existing = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(and(...conditions))
    .limit(1);

  if (existing.length === 0) return slug;

  return `${slug}-${Date.now()}`;
}

// --- Community Permission Helpers ---

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

const PERMISSION_MAP: Record<string, number> = {
  editCommunity: 3,    // admin+
  manageMembers: 3,    // admin+
  banUser: 2,          // moderator+
  kickMember: 2,       // moderator+
  deletePost: 2,       // moderator+
  pinPost: 2,          // moderator+
  lockPost: 2,         // moderator+
};

/** Check if a role has a specific permission */
export function hasPermission(role: string, permission: string): boolean {
  const roleLevel = ROLE_HIERARCHY[role] ?? 0;
  const requiredLevel = PERMISSION_MAP[permission] ?? Infinity;
  return roleLevel >= requiredLevel;
}

/** Check if actorRole can manage targetRole */
export function canManageRole(actorRole: string, targetRole: string): boolean {
  const actorLevel = ROLE_HIERARCHY[actorRole] ?? 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] ?? 0;
  return actorLevel > targetLevel;
}
