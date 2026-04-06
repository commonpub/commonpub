import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';

export const docsSites = pgTable('docs_sites', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  description: text('description'),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  themeTokens: jsonb('theme_tokens').$type<Record<string, string>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_docs_sites_owner_id').on(t.ownerId),
]);

export const docsVersions = pgTable(
  'docs_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => docsSites.id, { onDelete: 'cascade' }),
    version: varchar('version', { length: 32 }).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('docs_versions_site_version').on(t.siteId, t.version),
    index('idx_docs_versions_site_id').on(t.siteId),
  ],
);

export const docsPages = pgTable('docs_pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  versionId: uuid('version_id')
    .notNull()
    .references(() => docsVersions.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  content: text('content').notNull(),
  status: varchar('status', { length: 16 }).default('draft').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  // Self-referencing FK handled via relations; DB-level constraint added via migration
  parentId: uuid('parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_docs_pages_version_id').on(t.versionId),
  index('idx_docs_pages_parent_id').on(t.parentId),
]);

export const docsNav = pgTable('docs_nav', {
  id: uuid('id').defaultRandom().primaryKey(),
  versionId: uuid('version_id')
    .notNull()
    .references(() => docsVersions.id, { onDelete: 'cascade' }),
  structure: jsonb('structure').$type<
    Array<{
      id: string;
      title: string;
      pageId?: string;
      children?: Array<{ id: string; title: string; pageId: string }>;
    }>
  >(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Relations ---

export const docsSitesRelations = relations(docsSites, ({ one, many }) => ({
  owner: one(users, { fields: [docsSites.ownerId], references: [users.id] }),
  versions: many(docsVersions),
}));

export const docsVersionsRelations = relations(docsVersions, ({ one, many }) => ({
  site: one(docsSites, { fields: [docsVersions.siteId], references: [docsSites.id] }),
  pages: many(docsPages),
  nav: many(docsNav),
}));

export const docsPagesRelations = relations(docsPages, ({ one, many }) => ({
  version: one(docsVersions, { fields: [docsPages.versionId], references: [docsVersions.id] }),
  parent: one(docsPages, {
    fields: [docsPages.parentId],
    references: [docsPages.id],
    relationName: 'pageHierarchy',
  }),
  children: many(docsPages, { relationName: 'pageHierarchy' }),
}));

export const docsNavRelations = relations(docsNav, ({ one }) => ({
  version: one(docsVersions, { fields: [docsNav.versionId], references: [docsVersions.id] }),
}));

// --- Inferred Types ---
export type DocsSiteRow = typeof docsSites.$inferSelect;
export type NewDocsSiteRow = typeof docsSites.$inferInsert;
export type DocsVersionRow = typeof docsVersions.$inferSelect;
export type NewDocsVersionRow = typeof docsVersions.$inferInsert;
export type DocsPageRow = typeof docsPages.$inferSelect;
export type NewDocsPageRow = typeof docsPages.$inferInsert;
export type DocsNavRow = typeof docsNav.$inferSelect;
export type NewDocsNavRow = typeof docsNav.$inferInsert;
