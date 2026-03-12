import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
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
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  subtitle: varchar('subtitle', { length: 255 }),
  description: text('description'),
  content: jsonb('content'),
  coverImageUrl: text('cover_image_url'),
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
  // Counters (denormalized for read performance)
  viewCount: integer('view_count').default(0).notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  forkCount: integer('fork_count').default(0).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const contentForks = pgTable('content_forks', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  forkId: uuid('fork_id')
    .notNull()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

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
});

// --- Relations ---

export const contentItemsRelations = relations(contentItems, ({ one, many }) => ({
  author: one(users, { fields: [contentItems.authorId], references: [users.id] }),
  tags: many(contentTags),
  forksFrom: many(contentForks, { relationName: 'forkSource' }),
  forksTo: many(contentForks, { relationName: 'forkTarget' }),
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
