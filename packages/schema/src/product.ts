import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { hubs } from './hub.js';
import { contentItems } from './content.js';
import { productStatusEnum, productCategoryEnum } from './enums.js';

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  hubId: uuid('hub_id')
    .notNull()
    .references(() => hubs.id, { onDelete: 'cascade' }),
  category: productCategoryEnum('category'),
  specs: jsonb('specs').$type<Record<string, string>>(),
  imageUrl: text('image_url'),
  purchaseUrl: text('purchase_url'),
  datasheetUrl: text('datasheet_url'),
  alternatives: jsonb('alternatives').$type<Array<{ productId: string; reason: string }>>(),
  pricing: jsonb('pricing').$type<{
    min?: number;
    max?: number;
    currency?: string;
    asOf?: string;
  }>(),
  status: productStatusEnum('status').default('active').notNull(),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_products_hub_id').on(t.hubId),
  index('idx_products_created_by_id').on(t.createdById),
]);

export const contentProducts = pgTable(
  'content_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contentId: uuid('content_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').default(1).notNull(),
    role: varchar('role', { length: 64 }),
    notes: text('notes'),
    required: boolean('required').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('idx_content_product_unique').on(t.contentId, t.productId),
    index('idx_content_products_product_id').on(t.productId),
  ],
);

// --- Relations ---

export const productsRelations = relations(products, ({ one, many }) => ({
  hub: one(hubs, { fields: [products.hubId], references: [hubs.id] }),
  createdBy: one(users, { fields: [products.createdById], references: [users.id] }),
  contentProducts: many(contentProducts),
}));

export const contentProductsRelations = relations(contentProducts, ({ one }) => ({
  content: one(contentItems, {
    fields: [contentProducts.contentId],
    references: [contentItems.id],
  }),
  product: one(products, {
    fields: [contentProducts.productId],
    references: [products.id],
  }),
}));

// --- Inferred Types ---
export type ProductRow = typeof products.$inferSelect;
export type NewProductRow = typeof products.$inferInsert;
export type ContentProductRow = typeof contentProducts.$inferSelect;
export type NewContentProductRow = typeof contentProducts.$inferInsert;
