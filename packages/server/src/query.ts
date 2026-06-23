/**
 * Generic query helpers to eliminate duplication across domain modules.
 *
 * - ensureUniqueSlugFor: replaces 5 copy-pasted slug uniqueness functions
 * - USER_REF_SELECT: replaces 20+ inline user select shapes
 * - normalizePagination / countRows: replaces identical pagination boilerplate in 15+ list functions
 * - buildPartialUpdates: replaces identical update-builder blocks in 12+ update functions
 * - buildContentPath / buildContentUrl: canonical content URL construction
 */

import { eq, and, ne, or, lt, isNull, sql } from 'drizzle-orm';
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

/** Extended user ref with headline + banner (for content detail) */
export const USER_REF_WITH_HEADLINE_SELECT = {
  ...USER_REF_SELECT,
  bio: users.bio,
  headline: users.headline,
  bannerUrl: users.bannerUrl,
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

/**
 * Normalize pagination options to safe values.
 *
 * Guards non-finite input: routes pass `Number(query.limit)`, so `?limit=abc` yields NaN.
 * `??` does NOT catch NaN, and `Math.min(NaN, 100)` is NaN → `LIMIT NaN` → an
 * unauthenticated 500 on public list endpoints (audit session 203). Clamp limit to
 * [1, maxLimit] and offset to >= 0, falling back to the default when not a finite number.
 *
 * `defaults.limit` sets the page size used when `opts.limit` is absent/invalid (each
 * list endpoint has its own default, e.g. 20/24/50); `defaults.maxLimit` caps the
 * upper bound (default 100). The single source of truth for pagination clamping —
 * prefer this over a hand-rolled `Math.min(opts.limit ?? N, 100)`, which mishandles
 * NaN, zero, and negative input.
 */
export function normalizePagination(
  opts: PaginationOpts,
  defaults: { limit?: number; maxLimit?: number } = {},
): { limit: number; offset: number } {
  const maxLimit = defaults.maxLimit ?? 100;
  const fallback = Math.min(Math.max(Math.trunc(defaults.limit ?? 20), 1), maxLimit);
  const limit = Number.isFinite(opts.limit)
    ? Math.min(Math.max(Math.trunc(opts.limit as number), 1), maxLimit)
    : fallback;
  const offset = Number.isFinite(opts.offset)
    ? Math.max(Math.trunc(opts.offset as number), 0)
    : 0;
  return { limit, offset };
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

// ---- Keyset (cursor) pagination ----

/**
 * Decoded keyset cursor: the lead sort value + the unique `id` tiebreaker.
 * Date columns are carried as an ISO string; numeric columns as a number; the
 * NULLS-LAST tail as `null`.
 */
export interface KeysetCursor {
  v: string | number | null;
  id: string | number;
}

/**
 * Encode an opaque keyset cursor as base64url of `{ v, id }`.
 *
 * Opaque, not signed: the values already appear in the feed the client is reading,
 * so there's nothing to hide — we only need the client to round-trip them back.
 * `Date` values are serialised to ISO strings so {@link keysetWhere} can rebuild a
 * `Date` for the comparison (avoids text↔timestamp cast ambiguity at the driver).
 */
export function encodeCursor(value: Date | string | number | null, id: string | number): string {
  const v = value instanceof Date ? value.toISOString() : value;
  return Buffer.from(JSON.stringify({ v, id }), 'utf8').toString('base64url');
}

/**
 * Decode a keyset cursor. Returns null on ANY malformed input — including
 * semantically-invalid (not just structurally-invalid) values — so a hostile or
 * stale cursor safely falls back to page 1 rather than reaching SQL.
 *
 * Validation enforces {@link encodeCursor}'s output contract:
 *  - a STRING `v` is only ever an ISO date (that's all encodeCursor emits as a string),
 *    so a string that doesn't parse to a finite Date is rejected. (Without this, a
 *    crafted `{"v":"garbage"}` reaches `new Date(...).toISOString()` in keysetWhere and
 *    throws a RangeError → unhandled 500 — a trivial unauthenticated DoS.)
 *  - a NUMBER `v` must be finite (no NaN/±Infinity).
 *  - `id` must be a non-empty string or a finite number.
 * The CALLER additionally validates the cursor matches its column types (e.g. the
 * content feed requires a date-or-null `v` and a uuid `id` — see listContentKeyset).
 */
export function decodeCursor(cursor: string | null | undefined): KeysetCursor | null {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { v, id } = parsed as Record<string, unknown>;
    if (typeof id === 'string') {
      if (id.length === 0) return null;
    } else if (typeof id !== 'number' || !Number.isFinite(id)) {
      return null;
    }
    if (v === null) {
      return { v, id };
    }
    if (typeof v === 'string') {
      // String v is an ISO date (encodeCursor's only string output) — must be parseable.
      if (!Number.isFinite(new Date(v).getTime())) return null;
      return { v, id };
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      return { v, id };
    }
    return null;
  } catch {
    return null;
  }
}

/** RFC-4122 uuid (any version), case-insensitive. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Narrow a decoded cursor to a DATE-keyed, UUID-id feed (the content feed's shape:
 * `publishedAt` timestamp + `id` uuid). Returns the cursor only if `v` is null or an
 * ISO-date string AND `id` is a uuid — otherwise null (page-1 fallback). A numeric `v`
 * (bound against a timestamp column) or a non-uuid `id` (bound against a uuid column)
 * would otherwise error at the SQL layer → 500. Use this at the boundary of any
 * date+uuid keyset query that decodes an untrusted cursor.
 */
export function asDateUuidCursor(cursor: KeysetCursor | null): KeysetCursor | null {
  if (!cursor) return null;
  if (cursor.v !== null && typeof cursor.v !== 'string') return null;
  if (typeof cursor.id !== 'string' || !UUID_RE.test(cursor.id)) return null;
  return cursor;
}

/**
 * WHERE condition selecting rows strictly AFTER `cursor` in the total order
 * `ORDER BY sortCol DESC NULLS LAST, idCol DESC`.
 *
 * NULLS-LAST semantics (must match the query's ORDER BY exactly — a mismatch is the
 * load-more-dup class of bug):
 *  - cursor.v non-null → `sortCol < v  OR  (sortCol = v AND id < cursorId)  OR  sortCol IS NULL`
 *  - cursor.v null     → already in the null tail → `sortCol IS NULL AND id < cursorId`
 *
 * Assumes string cursor values are dates (the feed sorts are publishedAt + viewCount);
 * revisit if a text-keyed sort is ever paginated this way.
 */
export function keysetWhere(sortCol: PgColumn, idCol: PgColumn, cursor: KeysetCursor): SQL {
  if (cursor.v === null) {
    return and(isNull(sortCol), lt(idCol, cursor.id)) as SQL;
  }
  const val = typeof cursor.v === 'string' ? new Date(cursor.v) : cursor.v;
  return or(
    lt(sortCol, val),
    and(eq(sortCol, val), lt(idCol, cursor.id)),
    isNull(sortCol),
  ) as SQL;
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
