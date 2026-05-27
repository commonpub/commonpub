/**
 * Custom-page scope validation — conflict detection.
 *
 * Spec: docs/plans/layout-and-pages.md §6.2.
 *
 * Called from the admin save handler BEFORE saveLayout(). Three checks:
 *   1. Path normalises cleanly (delegates to pathNormalize)
 *   2. Path doesn't collide with a file-defined Nuxt route
 *   3. Path doesn't collide with another custom-page layout
 *
 * Returns `{ok:true, normalisedScope}` or `{ok:false, reason, message}`.
 * Admin handler maps reasons to HTTP status codes (400 for malformed,
 * 409 for collision).
 *
 * **File-routes manifest**: Phase 2 ships a hardcoded list of the
 * layer's known top-level route names. Phase 3 will replace with a
 * Nitro plugin that scans Nuxt's compiled route table at startup +
 * publishes via event.context. The hardcoded list is the conservative
 * floor — a custom page can't claim any of these top-level segments
 * even if the consumer app removes one (avoids surprise breaks for
 * thin apps that re-add the route in a future bump).
 */
import { sql } from 'drizzle-orm';
import { pathNormalize, type NormalisePathRejection } from './path-normalize.js';
import type { LayoutScope } from './layout.js';
import type { DB } from '../types.js';

/**
 * Top-level path segments owned by file-defined routes in the layer.
 * Generated from `ls layers/base/pages/` (session 159), trimmed to the
 * names that occupy URL space (not the dynamic segments like `[type]`
 * or the catch-all `[...customPath]`).
 *
 * **A custom page CANNOT claim any path that starts with one of these.**
 * A thin app that ADDS new pages should add their top-level segment
 * here too — Phase 3's startup scanner will obsolete this list.
 */
export const FILE_ROUTE_PREFIXES: ReadonlySet<string> = new Set([
  'about',
  'admin',
  'auth',
  'authorize_interaction',
  'cert',
  'contests',
  'cookies',
  'create',
  'dashboard',
  'docs',
  'events',
  'explore',
  'federated-hubs',
  'federation',
  'feed',
  'hubs',
  'learn',
  'messages',
  'mirror',
  'notifications',
  'privacy',
  'products',
  'search',
  'settings',
  'tags',
  'terms',
  'u',
  'videos',
]);

export type CustomPageRejectReason =
  | NormalisePathRejection
  | 'file-route-conflict'
  | 'custom-page-already-exists';

export type CustomPageValidateResult =
  | { ok: true; scope: Extract<LayoutScope, { type: 'custom-page' }> }
  | { ok: false; reason: CustomPageRejectReason; message: string };

export interface ValidateCustomPageOptions {
  /**
   * Layout id being updated. If provided, an existing layout at the
   * same path with this id passes (the admin is editing the page they
   * already own); otherwise the duplicate check fires. Omit for
   * create-mode.
   */
  excludeLayoutId?: string;
  /**
   * Override the file-routes manifest. Tests + thin apps can inject a
   * specific list; default is `FILE_ROUTE_PREFIXES`.
   */
  fileRoutePrefixes?: ReadonlySet<string>;
}

export async function validateCustomPageScope(
  db: DB,
  rawPath: unknown,
  opts: ValidateCustomPageOptions = {},
): Promise<CustomPageValidateResult> {
  // 1. Normalise
  const norm = pathNormalize(rawPath);
  if (!norm.ok) {
    return {
      ok: false,
      reason: norm.reason,
      message: `Invalid custom-page path: ${norm.reason}`,
    };
  }

  // 2. File-route conflict — check the first segment
  const prefixes = opts.fileRoutePrefixes ?? FILE_ROUTE_PREFIXES;
  const topSegment = norm.path.slice(1).split('/')[0];
  if (topSegment && prefixes.has(topSegment)) {
    return {
      ok: false,
      reason: 'file-route-conflict',
      message: `Path /${topSegment} is owned by a built-in route; custom pages can't override it`,
    };
  }

  // 3. Existing custom-page at this path — raw query against the layouts
  //    table since this is a read-only validation that doesn't fit the
  //    full saveLayout payload shape.
  const existing = await db.execute<{ id: string }>(
    sql`SELECT id FROM layouts WHERE scope_type = 'custom-page' AND scope_key = ${norm.path} LIMIT 1`,
  );
  const rows: Array<{ id: string }> =
    Array.isArray(existing) ? existing :
    Array.isArray((existing as { rows?: unknown[] }).rows) ? (existing as { rows: Array<{ id: string }> }).rows :
    [];
  const conflicting = rows[0];
  if (conflicting && conflicting.id !== opts.excludeLayoutId) {
    return {
      ok: false,
      reason: 'custom-page-already-exists',
      message: `A custom page at ${norm.path} already exists`,
    };
  }

  return {
    ok: true,
    scope: { type: 'custom-page', path: norm.path },
  };
}
