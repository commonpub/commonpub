/**
 * Layout engine — server CRUD.
 *
 * Spec: `docs/plans/layout-and-pages.md` §3, §4, §5.
 *
 * Storage: 4 normalized tables (layouts → layout_rows → layout_sections,
 * layout_versions for snapshots). Defined in `@commonpub/schema`'s
 * `layout.ts` (session 155). Migration 0005 creates them; this module
 * is the only thing that reads/writes.
 *
 * Behaviour summary:
 *   - `listLayouts`, `getLayoutByScope`, `getLayoutById` are reads
 *   - `saveLayout` does atomic "replace whole layout" — accepts the
 *     entire nested zones→rows→sections payload, diffs against current
 *     state in a transaction, issues minimal inserts/updates/deletes,
 *     re-numbers positions to {0..n}
 *   - `publishLayout` snapshots current draft into layout_versions,
 *     sets `layouts.published_version_id`, transitions state to 'published'
 *   - `revertToVersion` copies a version's snapshot into the layout's
 *     current rows/sections (replacing them); does NOT delete the version
 *   - `deleteLayout` cascades through rows + sections + versions via FK
 *
 * Caching: callers cache the `getLayoutByScope` result (60s server-side,
 * 5min client-side). Cache invalidation: the SSR layer middleware calls
 * `invalidateLayoutCache()` after any write — see `instanceLayouts.ts`
 * in `layers/base/server/utils/` (next phase).
 */
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  layouts,
  layoutRows,
  layoutSections,
  layoutVersions,
  type LayoutSectionRow as LayoutSectionDbRow,
} from '@commonpub/schema';
import type { DB } from '../types.js';

// ---- Types --------------------------------------------------------------

/** Scope of a layout — what the layout is FOR. Discriminated union. */
export type LayoutScope =
  | { type: 'route'; path: string }
  | { type: 'virtual'; key: '__footer' | '__not-found' | '__error' }
  | { type: 'custom-page'; path: string };

export interface LayoutPageMeta {
  title: string;
  description?: string;
  ogImage?: string;
  noindex?: boolean;
  ogType?: 'website' | 'article' | 'profile';
  access?: 'public' | 'members' | 'admin';
  frame?: 'narrow' | 'wide' | 'two-column' | 'three-column' | 'sidebar-left' | 'sidebar-right';
}

export interface LayoutSectionInput {
  id?: string;
  order: number;
  type: string;
  config: Record<string, unknown>;
  colSpan?: number;
  responsive?: { sm?: number; md?: number; lg?: number };
  enabled?: boolean;
  visibility?: {
    roles?: string[];
    features?: string[];
    hideAt?: ('sm' | 'md' | 'lg')[];
  };
  schemaVersion?: number;
}

export interface LayoutRowInput {
  id?: string;
  order: number;
  config?: {
    gap?: 'none' | 'sm' | 'md' | 'lg';
    align?: 'start' | 'center' | 'stretch';
    background?: string;
    paddingY?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  };
  sections: LayoutSectionInput[];
}

export interface LayoutZoneInput {
  zone: string;
  rows: LayoutRowInput[];
}

export interface LayoutInput {
  scope: LayoutScope;
  name: string;
  pageMeta?: LayoutPageMeta;
  zones: LayoutZoneInput[];
  state?: 'draft' | 'published';
}

export interface LayoutRecord {
  id: string;
  scope: LayoutScope;
  name: string;
  pageMeta: LayoutPageMeta | null;
  state: 'draft' | 'published';
  publishedVersionId: string | null;
  zones: LayoutZone[];
  createdAt: string;
  updatedAt: string;
}

export interface LayoutZone {
  zone: string;
  rows: LayoutRowResolved[];
}

export interface LayoutRowResolved {
  id: string;
  order: number;
  config: LayoutRowInput['config'] | null;
  sections: LayoutSectionResolved[];
}

export interface LayoutSectionResolved {
  id: string;
  order: number;
  type: string;
  config: Record<string, unknown>;
  colSpan: number;
  responsive: { sm?: number; md?: number; lg?: number } | null;
  enabled: boolean;
  visibility: LayoutSectionInput['visibility'] | null;
  schemaVersion: number;
}

export interface LayoutVersionRecord {
  id: string;
  layoutId: string;
  version: number;
  snapshot: LayoutRecord;
  publishedBy: string | null;
  publishedAt: string;
}

// ---- Helpers ------------------------------------------------------------

function unpackScope(scopeType: string, scopeKey: string): LayoutScope {
  if (scopeType === 'route') return { type: 'route', path: scopeKey };
  if (scopeType === 'virtual') {
    return { type: 'virtual', key: scopeKey as '__footer' | '__not-found' | '__error' };
  }
  return { type: 'custom-page', path: scopeKey };
}

function packScope(scope: LayoutScope): { scopeType: string; scopeKey: string } {
  return {
    scopeType: scope.type,
    scopeKey: scope.type === 'virtual' ? scope.key : scope.path,
  };
}

/** Convert DB section row → resolved shape (typed JSON columns). */
function rowToSection(s: LayoutSectionDbRow): LayoutSectionResolved {
  return {
    id: s.id,
    order: s.position,
    type: s.type,
    config: (s.config ?? {}) as Record<string, unknown>,
    colSpan: s.colSpan,
    responsive: (s.responsive ?? null) as LayoutSectionResolved['responsive'],
    enabled: s.enabled,
    visibility: (s.visibility ?? null) as LayoutSectionResolved['visibility'],
    schemaVersion: s.schemaVersion,
  };
}

// ---- Reads --------------------------------------------------------------

/** Fetch a layout by scope. Returns the FULL nested shape (zones → rows → sections). */
export async function getLayoutByScope(db: DB, scope: LayoutScope): Promise<LayoutRecord | null> {
  const { scopeType, scopeKey } = packScope(scope);
  const [row] = await db
    .select()
    .from(layouts)
    .where(and(eq(layouts.scopeType, scopeType), eq(layouts.scopeKey, scopeKey)));
  if (!row) return null;
  return assembleLayout(db, row);
}

/** Fetch a layout by its uuid. */
export async function getLayoutById(db: DB, id: string): Promise<LayoutRecord | null> {
  const [row] = await db.select().from(layouts).where(eq(layouts.id, id));
  if (!row) return null;
  return assembleLayout(db, row);
}

/** List all layouts, optionally filtered by scope type. */
export async function listLayouts(
  db: DB,
  opts: { scopeType?: 'route' | 'virtual' | 'custom-page' } = {},
): Promise<LayoutRecord[]> {
  const rows = opts.scopeType
    ? await db.select().from(layouts).where(eq(layouts.scopeType, opts.scopeType))
    : await db.select().from(layouts);
  return Promise.all(rows.map((r) => assembleLayout(db, r)));
}

/** Inner helper: take a layout-table row + fetch its rows + sections, return assembled record. */
async function assembleLayout(db: DB, row: typeof layouts.$inferSelect): Promise<LayoutRecord> {
  const rowsForLayout = await db
    .select()
    .from(layoutRows)
    .where(eq(layoutRows.layoutId, row.id))
    .orderBy(asc(layoutRows.zone), asc(layoutRows.position));

  // R4 audit fix (P0-perf): WHERE clause on rowId. Without it Drizzle
  // ran SELECT * FROM layout_sections (no filter) on every layout fetch
  // — full table scan on the by-route hot path. The idx_layout_sections_row
  // index is now actually used by this query.
  const sectionRowIds = rowsForLayout.map((r) => r.id);
  const allSections = sectionRowIds.length > 0
    ? await db
        .select()
        .from(layoutSections)
        .where(inArray(layoutSections.rowId, sectionRowIds))
        .orderBy(asc(layoutSections.position))
    : [];

  const sectionsByRow = new Map<string, LayoutSectionResolved[]>();
  for (const s of allSections) {
    const arr = sectionsByRow.get(s.rowId) ?? [];
    arr.push(rowToSection(s));
    sectionsByRow.set(s.rowId, arr);
  }

  // Group rows by zone preserving order
  const zoneMap = new Map<string, LayoutRowResolved[]>();
  for (const r of rowsForLayout) {
    const list = zoneMap.get(r.zone) ?? [];
    list.push({
      id: r.id,
      order: r.position,
      config: (r.config ?? null) as LayoutRowInput['config'] | null,
      sections: sectionsByRow.get(r.id) ?? [],
    });
    zoneMap.set(r.zone, list);
  }
  const zones: LayoutZone[] = [...zoneMap.entries()].map(([zone, rs]) => ({ zone, rows: rs }));

  return {
    id: row.id,
    scope: unpackScope(row.scopeType, row.scopeKey),
    name: row.name,
    pageMeta: (row.pageMeta ?? null) as LayoutPageMeta | null,
    state: row.state as 'draft' | 'published',
    publishedVersionId: row.publishedVersionId,
    zones,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---- Writes -------------------------------------------------------------

/**
 * Save a layout — atomic "replace whole layout" semantics. Accepts the
 * full nested zones → rows → sections payload, normalizes positions to
 * {0..n}, and rewrites the children in a single transaction.
 *
 * Returns the saved layout in resolved form. Server-generates UUIDs for
 * any row/section without an `id` (treats them as new). Existing rows
 * with the same `id` are preserved (stable across reorders).
 */
export async function saveLayout(
  db: DB,
  input: LayoutInput,
  opts: { id?: string; userId?: string } = {},
): Promise<LayoutRecord> {
  const { scopeType, scopeKey } = packScope(input.scope);
  const now = new Date();

  // Wrap the whole upsert + child rewrite in a single transaction so two
  // admins saving the same layout simultaneously can't interleave their
  // delete + insert calls (which would either lose data silently OR hit
  // the unique-(layout_id,zone,position) constraint and 500). Last-writer-
  // wins semantics still apply at the transaction boundary, but the
  // partial-state failure mode is impossible inside the tx.
  //
  // PGlite (used by tests) supports db.transaction; real Postgres ditto.
  const layoutId = await db.transaction(async (tx) => {
    let id = opts.id ?? null;
    if (!id) {
      // Look up by scope first — one layout per scope is the invariant.
      const [existing] = await tx
        .select({ id: layouts.id })
        .from(layouts)
        .where(and(eq(layouts.scopeType, scopeType), eq(layouts.scopeKey, scopeKey)));
      id = existing?.id ?? null;
    }

    // Upsert the layouts row first (need its id for FK).
    if (id) {
      await tx
        .update(layouts)
        .set({
          name: input.name,
          pageMeta: input.pageMeta ?? null,
          state: input.state ?? 'draft',
          updatedBy: opts.userId ?? null,
          updatedAt: now,
        })
        .where(eq(layouts.id, id));
    } else {
      const [created] = await tx
        .insert(layouts)
        .values({
          scopeType,
          scopeKey,
          name: input.name,
          pageMeta: input.pageMeta ?? null,
          state: input.state ?? 'draft',
          createdBy: opts.userId ?? null,
          updatedBy: opts.userId ?? null,
        })
        .returning({ id: layouts.id });
      id = created!.id;
    }

    // Children rewrite — delete all rows for this layout (sections cascade),
    // then re-insert from input. Position-stable IDs are preserved when the
    // input row has an `id` field.
    await tx.delete(layoutRows).where(eq(layoutRows.layoutId, id));

    // Normalize positions {0..n} per zone for rows, {0..n} per row for sections
    // (ignore caller-provided values to enforce canonical order).
    const zoneRowsToInsert: Array<{
      id?: string;
      zone: string;
      position: number;
      config: LayoutRowInput['config'] | null;
      sections: LayoutSectionInput[];
    }> = [];
    for (const z of input.zones) {
      const sorted = [...z.rows].sort((a, b) => a.order - b.order);
      sorted.forEach((r, i) => {
        zoneRowsToInsert.push({
          id: r.id,
          zone: z.zone,
          position: i,
          config: r.config ?? null,
          sections: r.sections,
        });
      });
    }

    if (zoneRowsToInsert.length === 0) {
      // Empty layout — children already cleared by the delete above
      return id;
    }

    // Insert rows + capture their final IDs
    const insertedRows = await tx
      .insert(layoutRows)
      .values(zoneRowsToInsert.map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        layoutId: id,
        zone: r.zone,
        position: r.position,
        config: r.config,
      })))
      .returning({ id: layoutRows.id, zone: layoutRows.zone, position: layoutRows.position });

    // Build {zone, position} → rowId map so we know where to attach sections
    const rowIdMap = new Map<string, string>();
    for (const r of insertedRows) {
      rowIdMap.set(`${r.zone}|${r.position}`, r.id);
    }

    // Insert sections per row
    const sectionsToInsert: Array<typeof layoutSections.$inferInsert> = [];
    for (const r of zoneRowsToInsert) {
      const rowId = rowIdMap.get(`${r.zone}|${r.position}`)!;
      const sortedSections = [...r.sections].sort((a, b) => a.order - b.order);
      sortedSections.forEach((s, i) => {
        sectionsToInsert.push({
          ...(s.id ? { id: s.id } : {}),
          rowId,
          position: i,
          enabled: s.enabled ?? true,
          type: s.type,
          config: s.config,
          colSpan: s.colSpan ?? 12,
          responsive: s.responsive ?? null,
          visibility: s.visibility ?? null,
          schemaVersion: s.schemaVersion ?? 1,
        });
      });
    }

    if (sectionsToInsert.length > 0) {
      await tx.insert(layoutSections).values(sectionsToInsert);
    }

    return id;
  });

  // Re-fetch outside the transaction so the returned shape uses the post-
  // commit state. (assembleLayout makes multiple selects; running them
  // inside the tx works too but isn't necessary.)
  return (await getLayoutById(db, layoutId))!;
}

/** Delete a layout. Cascades through rows + sections + versions via FK. */
export async function deleteLayout(db: DB, id: string): Promise<void> {
  await db.delete(layouts).where(eq(layouts.id, id));
}

// ---- Versioning ---------------------------------------------------------

/**
 * Snapshot the current layout into `layout_versions`, set the layout's
 * `published_version_id`, transition state → 'published'. The snapshot is
 * the full nested record at the moment of publish.
 */
export async function publishLayout(
  db: DB,
  id: string,
  opts: { publishedBy?: string } = {},
): Promise<LayoutVersionRecord> {
  const current = await getLayoutById(db, id);
  if (!current) throw new Error(`Layout not found: ${id}`);

  // Compute next version number
  const [latest] = await db
    .select({ version: layoutVersions.version })
    .from(layoutVersions)
    .where(eq(layoutVersions.layoutId, id))
    .orderBy(desc(layoutVersions.version))
    .limit(1);
  const nextVersion = (latest?.version ?? 0) + 1;

  const [inserted] = await db
    .insert(layoutVersions)
    .values({
      layoutId: id,
      version: nextVersion,
      snapshot: current as unknown as Record<string, unknown>,
      publishedBy: opts.publishedBy ?? null,
    })
    .returning();

  await db
    .update(layouts)
    .set({ publishedVersionId: inserted!.id, state: 'published', updatedAt: new Date() })
    .where(eq(layouts.id, id));

  return {
    id: inserted!.id,
    layoutId: id,
    version: nextVersion,
    snapshot: current,
    publishedBy: inserted!.publishedBy,
    publishedAt: inserted!.publishedAt.toISOString(),
  };
}

/** List versions for a layout, newest first. */
export async function listLayoutVersions(db: DB, layoutId: string): Promise<LayoutVersionRecord[]> {
  const rows = await db
    .select()
    .from(layoutVersions)
    .where(eq(layoutVersions.layoutId, layoutId))
    .orderBy(desc(layoutVersions.version));

  return rows.map((r) => ({
    id: r.id,
    layoutId: r.layoutId,
    version: r.version,
    snapshot: r.snapshot as unknown as LayoutRecord,
    publishedBy: r.publishedBy,
    publishedAt: r.publishedAt.toISOString(),
  }));
}

/**
 * Revert: rewrite the current layout's rows + sections from a snapshot.
 * The original version row is NOT touched — snapshots are immutable.
 */
export async function revertToVersion(
  db: DB,
  layoutId: string,
  versionId: string,
  opts: { userId?: string } = {},
): Promise<LayoutRecord> {
  const [v] = await db
    .select()
    .from(layoutVersions)
    .where(and(eq(layoutVersions.layoutId, layoutId), eq(layoutVersions.id, versionId)));
  if (!v) throw new Error(`Version not found: layout=${layoutId} version=${versionId}`);

  const snap = v.snapshot as unknown as LayoutRecord;

  // Re-write via saveLayout with the snapshot's zones — preserves IDs so
  // any pinned section ids in URL bookmarks etc still resolve.
  return saveLayout(
    db,
    {
      scope: snap.scope,
      name: snap.name,
      pageMeta: snap.pageMeta ?? undefined,
      zones: snap.zones.map((z) => ({
        zone: z.zone,
        rows: z.rows.map((r) => ({
          id: r.id,
          order: r.order,
          config: r.config ?? undefined,
          sections: r.sections.map((s) => ({
            id: s.id,
            order: s.order,
            type: s.type,
            config: s.config,
            colSpan: s.colSpan,
            responsive: s.responsive ?? undefined,
            enabled: s.enabled,
            visibility: s.visibility ?? undefined,
            schemaVersion: s.schemaVersion,
          })),
        })),
      })),
      state: 'draft',
    },
    { id: layoutId, userId: opts.userId },
  );
}
