import { eq, and, ne } from 'drizzle-orm';
import { contentItems, communities } from '@snaplify/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Generate a URL-friendly slug from a title.
 * Lowercase, replace non-alphanumeric with hyphens, collapse consecutive hyphens, trim.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-') // replace non-alnum with hyphens
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .replace(/-{2,}/g, '-'); // collapse consecutive hyphens
}

/**
 * Ensure a slug is unique in the contentItems table.
 * Appends a timestamp suffix on collision.
 */
export async function ensureUniqueSlug(
  db: NodePgDatabase<Record<string, unknown>>,
  slug: string,
  excludeId?: string,
): Promise<string> {
  if (!slug) {
    slug = `untitled-${Date.now()}`;
  }

  const conditions = [eq(contentItems.slug, slug)];
  if (excludeId) {
    conditions.push(ne(contentItems.id, excludeId));
  }

  const existing = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(and(...conditions))
    .limit(1);

  if (existing.length === 0) {
    return slug;
  }

  return `${slug}-${Date.now()}`;
}

/**
 * Ensure a slug is unique in the communities table.
 * Appends a timestamp suffix on collision.
 */
export async function ensureUniqueCommunitySlug(
  db: NodePgDatabase<Record<string, unknown>>,
  slug: string,
  excludeId?: string,
): Promise<string> {
  if (!slug) {
    slug = `community-${Date.now()}`;
  }

  const conditions = [eq(communities.slug, slug)];
  if (excludeId) {
    conditions.push(ne(communities.id, excludeId));
  }

  const existing = await db
    .select({ id: communities.id })
    .from(communities)
    .where(and(...conditions))
    .limit(1);

  if (existing.length === 0) {
    return slug;
  }

  return `${slug}-${Date.now()}`;
}

/**
 * Handle slug constraint violation errors by retrying with a timestamp suffix.
 * Use this to wrap INSERT operations that may race on unique slug constraints.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as Error & { code: string }).code === '23505'
  );
}
