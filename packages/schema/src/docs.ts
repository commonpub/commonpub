import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth';

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
});

export const docsVersions = pgTable('docs_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  siteId: uuid('site_id')
    .notNull()
    .references(() => docsSites.id, { onDelete: 'cascade' }),
  version: varchar('version', { length: 32 }).notNull(),
  isDefault: integer('is_default').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const docsPages = pgTable('docs_pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  versionId: uuid('version_id')
    .notNull()
    .references(() => docsVersions.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  content: text('content').notNull(), // Raw markdown (Standing Rule #4)
  sortOrder: integer('sort_order').default(0).notNull(),
  parentId: uuid('parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

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
