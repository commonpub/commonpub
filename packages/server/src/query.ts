/**
 * Generic query helpers to eliminate duplication across domain modules.
 *
 * - ensureUniqueSlugFor: replaces 5 copy-pasted slug uniqueness functions
 * - USER_REF_SELECT: replaces 20+ inline user select shapes
 * - normalizePagination / countRows: replaces identical pagination boilerplate in 15+ list functions
 * - buildPartialUpdates: replaces identical update-builder blocks in 12+ update functions
 * - buildContentPath / buildContentUrl: canonical content URL construction
 */

import { eq, and, ne, sql } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import type { DB } from './types.js';

// ---- Content URL Builders ----

/**
 * Build the canonical relative path for a content item.
 * Single source of truth — every content link should use this.
 *
 * @example buildContentPath('alice', 'project', 'robot-arm') → '/u/alice/project/robot-arm'
 */
export function buildContentPath(username: string, type: string, slug: string): string {
  return `/u/${username}/${type}/${slug}`;
}

/**
 * Build the canonical absolute URL for a content item (for federation, feeds, SEO).
 *
 * @example buildContentUrl('hack.build', 'alice', 'project', 'robot-arm')
 *          → 'https://hack.build/u/alice/project/robot-arm'
 */
export function buildContentUrl(domain: string, username: string, type: string, slug: string): string {
  return `https://${domain}/u/${username}/${type}/${slug}`;
}

/**
 * Build the edit path for a content item.
 *
 * @example buildContentEditPath('alice', 'project', 'robot-arm') → '/u/alice/project/robot-arm/edit'
 */
export function buildContentEditPath(username: string, type: string, slug: string): string {
  return `/u/${username}/${type}/${slug}/edit`;
}

/**
 * Build the path for creating new content of a given type.
 *
 * @example buildContentNewPath('alice', 'project') → '/u/alice/project/new/edit'
 */
export function buildContentNewPath(username: string, type: string): string {
  return `/u/${username}/${type}/new/edit`;
}

// ---- USER_REF_SELECT ----

/** Standard user reference select shape. Use in Drizzle .select() calls. */
export const USER_REF_SELECT = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
} as const;

/** Extended user ref with bio (for content detail author, follow lists) */
export const USER_REF_WITH_BIO_SELECT = {
  ...USER_REF_SELECT,
  bio: users.bio,
} as const;

/** Extended user ref with headline (for content detail) */
export const USER_REF_WITH_HEADLINE_SELECT = {
  ...USER_REF_SELECT,
  bio: users.bio,
  headline: users.headline,
} as const;

// ---- ensureUniqueSlugFor ----

/**
 * Ensure a slug is unique for a given table. Appends a timestamp suffix if a collision is found.
 *
 * Replaces 5 identical copy-pasted functions (ensureUniqueSlug, ensureUniqueHubSlug,
 * ensureUniqueProductSlug, ensureUniqueDocsSiteSlug, ensureUniquePathSlug).
 *
 * @param db - Drizzle database instance
 * @param table - The Drizzle table to check against
 * @param slugCol - The slug column reference (e.g. contentItems.slug)
 * @param idCol - The id column reference (e.g. contentItems.id)
 * @param slug - The desired slug
 * @param fallbackPrefix - Prefix for auto-generated slugs when input is empty (e.g. 'untitled', 'hub', 'product')
 * @param excludeId - Optional ID to exclude from the uniqueness check (for updates)
 * @param scopeCols - Optional additional columns to scope uniqueness (e.g. for author+type scoped slugs)
 */
export async function ensureUniqueSlugFor(
  db: DB,
  table: PgTable,
  slugCol: PgColumn,
  idCol: PgColumn,
  slug: string,
  fallbackPrefix: string,
  excludeId?: string,
  scopeCols?: Array<{ col: PgColumn; value: string }>,
): Promise<string> {
  if (!slug) slug = `${fallbackPrefix}-${Date.now()}`;

  const conditions: SQL[] = [eq(slugCol, slug)];
  if (excludeId) {
    conditions.push(ne(idCol, excludeId));
  }
  if (scopeCols) {
    for (const { col, value } of scopeCols) {
      conditions.push(eq(col, value));
    }
  }

  const existing = await db
    .select({ id: idCol })
    .from(table)
    .where(and(...conditions))
    .limit(1);

  if (existing.length === 0) return slug;
  return `${slug}-${Date.now()}`;
}

// ---- Pagination Helpers ----

/** Pagination filter shape (matches the common pattern across all list functions) */
export interface PaginationOpts {
  limit?: number;
  offset?: number;
}

/** Normalize pagination options to safe values */
export function normalizePagination(opts: PaginationOpts): { limit: number; offset: number } {
  return {
    limit: Math.min(opts.limit ?? 20, 100),
    offset: opts.offset ?? 0,
  };
}

/**
 * Execute a count query. Returns 0 if no results.
 * Replaces the identical `db.select({ count: sql\`count(*)::int\` }).from(table).where(where)` pattern.
 */
export async function countRows(
  db: DB,
  table: PgTable,
  where?: SQL,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(where);
  return result[0]?.count ?? 0;
}

// ---- LIKE Escape ----

/** Escape LIKE/ILIKE wildcard characters in a search term */
export function escapeLike(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&');
}

// ---- Partial Update Builder ----

/**
 * Build a partial update object from input, filtering out undefined values.
 * Always includes `updatedAt: new Date()`.
 *
 * @param input - The input object (from validated request body)
 * @param fieldMap - Optional mapping from input keys to DB column names
 *                   e.g. { durationMinutes: 'duration' }
 */
export function buildPartialUpdates<TInput extends Record<string, unknown>>(
  input: TInput,
  fieldMap?: Partial<Record<keyof TInput & string, string>>,
): Record<string, unknown> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      const dbField = fieldMap?.[key as keyof TInput & string] ?? key;
      updates[dbField] = value;
    }
  }
  return updates;
}
