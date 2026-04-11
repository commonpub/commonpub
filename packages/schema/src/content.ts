import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { contentStatusEnum, contentTypeEnum, difficultyEnum, contentVisibilityEnum } from './enums.js';

export const contentItems = pgTable('content_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: contentTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  subtitle: varchar('subtitle', { length: 255 }),
  description: text('description'),
  content: jsonb('content'),
  coverImageUrl: text('cover_image_url'),
  bannerUrl: text('banner_url'),
  category: varchar('category', { length: 64 }),
  difficulty: difficultyEnum('difficulty'),
  buildTime: varchar('build_time', { length: 64 }),
  estimatedCost: varchar('estimated_cost', { length: 64 }),
  status: contentStatusEnum('status').default('draft').notNull(),
  visibility: contentVisibilityEnum('visibility').default('public').notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  seoDescription: varchar('seo_description', { length: 320 }),
  previewToken: varchar('preview_token', { length: 64 }),
  // Parts list (for projects)
  parts: jsonb('parts').$type<
    Array<{
      id: string;
      name: string;
      description?: string;
      quantity: number;
      url?: string;
      price?: number;
      currency?: string;
      category?: string;
      required: boolean;
    }>
  >(),
  // Explainer sections — validated at runtime via @commonpub/explainer schemas
  sections: jsonb('sections').$type<
    Array<{
      id: string;
      title: string;
      anchor: string;
      type: 'text' | 'interactive' | 'quiz' | 'checkpoint';
      content?: unknown;
      [key: string]: unknown;
    }>
  >(),
  // Additional metadata
  licenseType: varchar('license_type', { length: 32 }),
  series: varchar('series', { length: 128 }),
  estimatedMinutes: integer('estimated_minutes'),
  // Federation readiness
  canonicalUrl: text('canonical_url'),
  apObjectId: text('ap_object_id'),
  // Soft delete
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  // Counters (denormalized for read performance)
  viewCount: integer('view_count').default(0).notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  forkCount: integer('fork_count').default(0).notNull(),
  buildCount: integer('build_count').default(0).notNull(),
  boostCount: integer('boost_count').default(0).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (t) => [
  unique('content_items_author_type_slug').on(t.authorId, t.type, t.slug),
  index('idx_content_items_author_id').on(t.authorId),
  index('idx_content_items_status').on(t.status),
  index('idx_content_items_type').on(t.type),
  index('idx_content_items_published_at').on(t.publishedAt),
]);

export const contentVersions = pgTable('content_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  contentId: uuid('content_id')
    .notNull()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  title: varchar('title', { length: 255 }),
  content: jsonb('content'),
  metadata: jsonb('metadata'),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_content_versions_content_id').on(t.contentId),
]);

export const contentForks = pgTable('content_forks', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  forkId: uuid('fork_id')
    .notNull()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_content_forks_source_id').on(t.sourceId),
  index('idx_content_forks_fork_id').on(t.forkId),
]);

export const contentBuilds = pgTable(
  'content_builds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contentId: uuid('content_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('content_builds_user_content').on(t.userId, t.contentId),
    index('idx_content_builds_content_id').on(t.contentId),
  ],
);

export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).notNull().unique(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  category: varchar('category', { length: 32 }),
  usageCount: integer('usage_count').default(0).notNull(),
});

export const contentTags = pgTable('content_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  contentId: uuid('content_id')
    .notNull()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [
  index('idx_content_tags_content_id').on(t.contentId),
  index('idx_content_tags_tag_id').on(t.tagId),
]);

// --- Relations ---

export const contentItemsRelations = relations(contentItems, ({ one, many }) => ({
  author: one(users, { fields: [contentItems.authorId], references: [users.id] }),
  tags: many(contentTags),
  versions: many(contentVersions),
  forksFrom: many(contentForks, { relationName: 'forkSource' }),
  forksTo: many(contentForks, { relationName: 'forkTarget' }),
}));

export const contentVersionsRelations = relations(contentVersions, ({ one }) => ({
  content: one(contentItems, {
    fields: [contentVersions.contentId],
    references: [contentItems.id],
  }),
  createdBy: one(users, {
    fields: [contentVersions.createdById],
    references: [users.id],
  }),
}));

export const contentForksRelations = relations(contentForks, ({ one }) => ({
  source: one(contentItems, {
    fields: [contentForks.sourceId],
    references: [contentItems.id],
    relationName: 'forkSource',
  }),
  fork: one(contentItems, {
    fields: [contentForks.forkId],
    references: [contentItems.id],
    relationName: 'forkTarget',
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  contentTags: many(contentTags),
}));

export const contentTagsRelations = relations(contentTags, ({ one }) => ({
  content: one(contentItems, { fields: [contentTags.contentId], references: [contentItems.id] }),
  tag: one(tags, { fields: [contentTags.tagId], references: [tags.id] }),
}));

// --- Inferred Types ---
export type ContentItemRow = typeof contentItems.$inferSelect;
export type NewContentItemRow = typeof contentItems.$inferInsert;
export type ContentVersionRow = typeof contentVersions.$inferSelect;
export type NewContentVersionRow = typeof contentVersions.$inferInsert;
export type ContentForkRow = typeof contentForks.$inferSelect;
export type NewContentForkRow = typeof contentForks.$inferInsert;
export type TagRow = typeof tags.$inferSelect;
export type NewTagRow = typeof tags.$inferInsert;
export type ContentTagRow = typeof contentTags.$inferSelect;
export type NewContentTagRow = typeof contentTags.$inferInsert;
export type ContentBuildRow = typeof contentBuilds.$inferSelect;
export type NewContentBuildRow = typeof contentBuilds.$inferInsert;
