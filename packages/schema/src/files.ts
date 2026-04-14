import { pgTable, uuid, varchar, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { contentItems } from './content.js';
import { hubs } from './hub.js';
import { filePurposeEnum } from './enums.js';

export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  uploaderId: uuid('uploader_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }),
  mimeType: varchar('mime_type', { length: 128 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  storageKey: text('storage_key').notNull(),
  publicUrl: text('public_url'),
  purpose: filePurposeEnum('purpose').default('attachment').notNull(),
  contentId: uuid('content_id').references(() => contentItems.id, { onDelete: 'set null' }),
  hubId: uuid('hub_id').references(() => hubs.id, { onDelete: 'set null' }),
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_files_uploader_id').on(t.uploaderId),
  index('idx_files_content_id').on(t.contentId),
  index('idx_files_hub_id').on(t.hubId),
]);

export const filesRelations = relations(files, ({ one }) => ({
  uploader: one(users, { fields: [files.uploaderId], references: [users.id] }),
  content: one(contentItems, { fields: [files.contentId], references: [contentItems.id] }),
  hub: one(hubs, { fields: [files.hubId], references: [hubs.id] }),
}));

// --- Inferred Types ---
export type FileRow = typeof files.$inferSelect;
export type NewFileRow = typeof files.$inferInsert;
