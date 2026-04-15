import { pgTable, uuid, varchar, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { videoPlatformEnum } from './enums.js';

export const videos = pgTable('videos', {
  id: uuid('id').defaultRandom().primaryKey(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  url: text('url').notNull(),
  embedUrl: text('embed_url'),
  platform: videoPlatformEnum('platform').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  duration: varchar('duration', { length: 16 }),
  categoryId: uuid('category_id').references(() => videoCategories.id, { onDelete: 'set null' }),
  viewCount: integer('view_count').default(0).notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_videos_author_id').on(t.authorId),
  index('idx_videos_category_id').on(t.categoryId),
]);

export const videoCategories = pgTable('video_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).notNull().unique(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
});

// --- Relations ---

export const videosRelations = relations(videos, ({ one }) => ({
  author: one(users, { fields: [videos.authorId], references: [users.id] }),
  category: one(videoCategories, { fields: [videos.categoryId], references: [videoCategories.id] }),
}));

export const videoCategoriesRelations = relations(videoCategories, ({ many }) => ({
  videos: many(videos),
}));

// --- Inferred Types ---
export type VideoRow = typeof videos.$inferSelect;
export type NewVideoRow = typeof videos.$inferInsert;
export type VideoCategoryRow = typeof videoCategories.$inferSelect;
export type NewVideoCategoryRow = typeof videoCategories.$inferInsert;
