import { eq, asc } from 'drizzle-orm';
import { contentCategories } from '@commonpub/schema';
import type { ContentCategoryRow } from '@commonpub/schema';
import type { DB } from '../types.js';

export interface ContentCategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isSystem: boolean;
  createdAt: Date;
}

function mapRow(row: ContentCategoryRow): ContentCategoryItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sortOrder,
    isSystem: row.isSystem,
    createdAt: row.createdAt,
  };
}

export async function listContentCategories(db: DB): Promise<ContentCategoryItem[]> {
  const rows = await db
    .select()
    .from(contentCategories)
    .orderBy(asc(contentCategories.sortOrder), asc(contentCategories.name));
  return rows.map(mapRow);
}

export async function getContentCategory(db: DB, id: string): Promise<ContentCategoryItem | null> {
  const [row] = await db
    .select()
    .from(contentCategories)
    .where(eq(contentCategories.id, id))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function getContentCategoryBySlug(db: DB, slug: string): Promise<ContentCategoryItem | null> {
  const [row] = await db
    .select()
    .from(contentCategories)
    .where(eq(contentCategories.slug, slug))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function createContentCategory(
  db: DB,
  input: {
    name: string;
    slug: string;
    description?: string;
    color?: string;
    icon?: string;
    sortOrder?: number;
    isSystem?: boolean;
  },
): Promise<ContentCategoryItem> {
  const [row] = await db
    .insert(contentCategories)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      color: input.color ?? null,
      icon: input.icon ?? null,
      sortOrder: input.sortOrder ?? 0,
      isSystem: input.isSystem ?? false,
    })
    .returning();
  return mapRow(row!);
}

export async function updateContentCategory(
  db: DB,
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    description: string;
    color: string;
    icon: string;
    sortOrder: number;
  }>,
): Promise<ContentCategoryItem | null> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.slug !== undefined) updates.slug = input.slug;
  if (input.description !== undefined) updates.description = input.description;
  if (input.color !== undefined) updates.color = input.color;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

  if (Object.keys(updates).length === 0) return getContentCategory(db, id);

  const [row] = await db
    .update(contentCategories)
    .set(updates)
    .where(eq(contentCategories.id, id))
    .returning();
  return row ? mapRow(row) : null;
}

export async function deleteContentCategory(db: DB, id: string): Promise<boolean> {
  const result = await db
    .delete(contentCategories)
    .where(eq(contentCategories.id, id))
    .returning({ id: contentCategories.id });
  return result.length > 0;
}
