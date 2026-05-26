/**
 * Layout engine schema — four tables for the page composition system.
 * Spec: `docs/plans/layout-and-pages.md` §3.3 + §4.
 *
 * Layered shape: zone → row → section.
 *   - A `layouts` row exists per route, virtual key, or custom page.
 *   - Each layout has rows grouped by zone; each row has sections.
 *   - On publish, the entire layout is snapshotted into `layout_versions`.
 *
 * Why normalised tables (vs JSON-in-settings): reorders + section-level
 * RLS + per-section-type schema migrations are all cheap. See §4.2.
 */
import { pgTable, uuid, varchar, integer, boolean, jsonb, timestamp, index, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';

// --- Tables --------------------------------------------------------------

/**
 * One layout per scope. `scope_type + scope_key` is the unique addressing
 * key — e.g. `('route', '/')` for the homepage, `('custom-page', '/about')`
 * for a DB-stored page, `('virtual', '__footer')` for the site footer.
 */
export const layouts = pgTable(
  'layouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 'route' | 'virtual' | 'custom-page' — enforced in Zod, kept flexible at SQL layer */
    scopeType: varchar('scope_type', { length: 32 }).notNull(),
    /** Path for route/custom-page, virtual key for virtual */
    scopeKey: varchar('scope_key', { length: 512 }).notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    /** PageMeta — title, description, ogImage, frame, access, etc. Required for custom-page. */
    pageMeta: jsonb('page_meta'),
    /** 'draft' | 'published' — drafts are still resolvable for preview, only published serve public traffic */
    state: varchar('state', { length: 16 }).notNull().default('draft'),
    /**
     * Pointer to the version snapshot currently serving traffic. null = no
     * published version yet.
     *
     * **Soft FK by design**: a real FK to `layout_versions(id)` would create
     * a circular dependency (layouts.published_version_id → layout_versions →
     * layouts), forcing deferred constraints + chicken-and-egg inserts. The
     * server CRUD validates this id exists at write time + tolerates a stale
     * id at read time (treats it as "no published version" and falls back
     * to the latest version row).
     */
    publishedVersionId: uuid('published_version_id'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('layouts_scope_unique').on(t.scopeType, t.scopeKey),
    index('idx_layouts_scope').on(t.scopeType, t.scopeKey),
  ],
);

/**
 * A row groups sections horizontally inside a zone. The 12-column grid
 * (see plan §3.6) divides the row's width; each section's `colSpan`
 * determines how many of the 12 it occupies. Row-level styling (gap,
 * align, background, padding) lives in `config`.
 */
export const layoutRows = pgTable(
  'layout_rows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    layoutId: uuid('layout_id')
      .notNull()
      .references(() => layouts.id, { onDelete: 'cascade' }),
    /** Zone slug — must match a `<LayoutSlot zone>` declared by the page */
    zone: varchar('zone', { length: 64 }).notNull(),
    /** Order within zone; renumbered to {0..n} on every write */
    position: integer('position').notNull(),
    /** Row config — { gap?, align?, background?, paddingY? } */
    config: jsonb('config'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('layout_rows_position_unique').on(t.layoutId, t.zone, t.position),
    index('idx_layout_rows_layout').on(t.layoutId, t.zone, t.position),
  ],
);

/**
 * A section lives in exactly one row. `col_span` is the design-time width
 * (1–12); `responsive` overrides per breakpoint. `schema_version` drives
 * lazy per-type config migrations on read (see plan §10.6.1).
 */
export const layoutSections = pgTable(
  'layout_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    rowId: uuid('row_id')
      .notNull()
      .references(() => layoutRows.id, { onDelete: 'cascade' }),
    /** Position within row, left-to-right; renumbered on write */
    position: integer('position').notNull(),
    /** Admin can disable a section without deleting (preserves config) */
    enabled: boolean('enabled').notNull().default(true),
    /** Section-type slug — resolves in the SECTION_REGISTRY */
    type: varchar('type', { length: 128 }).notNull(),
    /** Per-type config blob — validated against the section's Zod schema before save */
    config: jsonb('config').notNull().default({}),
    /** 1–12; check constraint mirrors the Zod invariant for defence-in-depth */
    colSpan: integer('col_span').notNull().default(12),
    /** { sm?: 1-12, md?: 1-12, lg?: 1-12 } — falls through lg ↦ md ↦ sm ↦ colSpan */
    responsive: jsonb('responsive'),
    /** { roles?, features?, hideAt? } */
    visibility: jsonb('visibility'),
    /** Per-section-type config schema version; bumped when the type changes shape */
    schemaVersion: integer('schema_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('layout_sections_position_unique').on(t.rowId, t.position),
    index('idx_layout_sections_row').on(t.rowId, t.position),
    index('idx_layout_sections_type').on(t.type),
    check('layout_sections_col_span_check', sql`${t.colSpan} between 1 and 12`),
  ],
);

/**
 * Immutable snapshot — published once, never updated. Revert restores the
 * snapshot's data into the draft, leaving the original version row intact.
 */
export const layoutVersions = pgTable(
  'layout_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    layoutId: uuid('layout_id')
      .notNull()
      .references(() => layouts.id, { onDelete: 'cascade' }),
    /** Monotonically increasing version number per layout */
    version: integer('version').notNull(),
    /** Full nested Layout object captured at publish time */
    snapshot: jsonb('snapshot').notNull(),
    publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('layout_versions_version_unique').on(t.layoutId, t.version),
    index('idx_layout_versions_layout').on(t.layoutId, t.version),
  ],
);

// --- Relations -----------------------------------------------------------

export const layoutsRelations = relations(layouts, ({ many, one }) => ({
  rows: many(layoutRows),
  versions: many(layoutVersions),
  creator: one(users, { fields: [layouts.createdBy], references: [users.id], relationName: 'layoutCreator' }),
  updater: one(users, { fields: [layouts.updatedBy], references: [users.id], relationName: 'layoutUpdater' }),
}));

export const layoutRowsRelations = relations(layoutRows, ({ one, many }) => ({
  layout: one(layouts, { fields: [layoutRows.layoutId], references: [layouts.id] }),
  sections: many(layoutSections),
}));

export const layoutSectionsRelations = relations(layoutSections, ({ one }) => ({
  row: one(layoutRows, { fields: [layoutSections.rowId], references: [layoutRows.id] }),
}));

export const layoutVersionsRelations = relations(layoutVersions, ({ one }) => ({
  layout: one(layouts, { fields: [layoutVersions.layoutId], references: [layouts.id] }),
  publisher: one(users, { fields: [layoutVersions.publishedBy], references: [users.id] }),
}));

// --- Inferred types ------------------------------------------------------

export type LayoutRow = typeof layouts.$inferSelect;
export type NewLayoutRow = typeof layouts.$inferInsert;
export type LayoutRowRow = typeof layoutRows.$inferSelect;
export type NewLayoutRowRow = typeof layoutRows.$inferInsert;
export type LayoutSectionRow = typeof layoutSections.$inferSelect;
export type NewLayoutSectionRow = typeof layoutSections.$inferInsert;
export type LayoutVersionRow = typeof layoutVersions.$inferSelect;
export type NewLayoutVersionRow = typeof layoutVersions.$inferInsert;
