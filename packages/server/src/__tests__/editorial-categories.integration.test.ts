import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { contentItems } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createContent,
  listContent,
  getContentBySlug,
  updateContent,
  publishContent,
  forkContent,
} from '../content/content.js';
import {
  listContentCategories,
  getContentCategory,
  getContentCategoryBySlug,
  createContentCategory,
  updateContentCategory,
  deleteContentCategory,
} from '../content/categories.js';

describe('editorial & categories integration', () => {
  let db: DB;
  let userId: string;
  let adminId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db);
    userId = user.id;
    const admin = await createTestUser(db, { role: 'admin' });
    adminId = admin.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // --- Category CRUD ---

  describe('category CRUD', () => {
    it('creates a category with all fields', async () => {
      const cat = await createContentCategory(db, {
        name: 'News',
        slug: 'news',
        description: 'Breaking news and updates',
        color: 'var(--teal)',
        icon: 'fa-solid fa-newspaper',
        sortOrder: 0,
        isSystem: true,
      });

      expect(cat.id).toBeDefined();
      expect(cat.name).toBe('News');
      expect(cat.slug).toBe('news');
      expect(cat.description).toBe('Breaking news and updates');
      expect(cat.color).toBe('var(--teal)');
      expect(cat.icon).toBe('fa-solid fa-newspaper');
      expect(cat.sortOrder).toBe(0);
      expect(cat.isSystem).toBe(true);
    });

    it('creates a custom (non-system) category', async () => {
      const cat = await createContentCategory(db, {
        name: 'Reviews',
        slug: 'reviews',
      });

      expect(cat.isSystem).toBe(false);
      expect(cat.sortOrder).toBe(0);
      expect(cat.description).toBeNull();
    });

    it('lists categories ordered by sortOrder then name', async () => {
      // Create categories with different sort orders
      await createContentCategory(db, { name: 'Zebra', slug: 'zebra', sortOrder: 2 });
      await createContentCategory(db, { name: 'Alpha', slug: 'alpha', sortOrder: 1 });

      const cats = await listContentCategories(db);
      expect(cats.length).toBeGreaterThanOrEqual(4);

      // Verify sort order: sortOrder ascending, then name ascending
      for (let i = 1; i < cats.length; i++) {
        const prev = cats[i - 1]!;
        const curr = cats[i]!;
        if (prev.sortOrder === curr.sortOrder) {
          expect(prev.name.localeCompare(curr.name)).toBeLessThanOrEqual(0);
        } else {
          expect(prev.sortOrder).toBeLessThan(curr.sortOrder);
        }
      }
    });

    it('gets a category by ID', async () => {
      const created = await createContentCategory(db, { name: 'ById', slug: 'by-id' });
      const found = await getContentCategory(db, created.id);

      expect(found).not.toBeNull();
      expect(found!.name).toBe('ById');
    });

    it('gets a category by slug', async () => {
      const found = await getContentCategoryBySlug(db, 'news');
      expect(found).not.toBeNull();
      expect(found!.name).toBe('News');
    });

    it('returns null for nonexistent category', async () => {
      const found = await getContentCategory(db, '00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });

    it('updates category fields', async () => {
      const cat = await createContentCategory(db, { name: 'Old Name', slug: 'old-name' });
      const updated = await updateContentCategory(db, cat.id, {
        name: 'New Name',
        color: '#ff0000',
        sortOrder: 99,
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New Name');
      expect(updated!.color).toBe('#ff0000');
      expect(updated!.sortOrder).toBe(99);
      expect(updated!.slug).toBe('old-name'); // unchanged
    });

    it('deletes a custom category', async () => {
      const cat = await createContentCategory(db, { name: 'Deletable', slug: 'deletable' });
      const result = await deleteContentCategory(db, cat.id);

      expect(result.deleted).toBe(true);
      expect(result.error).toBeUndefined();

      const found = await getContentCategory(db, cat.id);
      expect(found).toBeNull();
    });

    it('refuses to delete a system category', async () => {
      const result = await deleteContentCategory(db, (await getContentCategoryBySlug(db, 'news'))!.id);

      expect(result.deleted).toBe(false);
      expect(result.error).toBe('system_category');

      // Verify it still exists
      const found = await getContentCategoryBySlug(db, 'news');
      expect(found).not.toBeNull();
    });

    it('returns not_found for nonexistent category deletion', async () => {
      const result = await deleteContentCategory(db, '00000000-0000-0000-0000-000000000000');

      expect(result.deleted).toBe(false);
      expect(result.error).toBe('not_found');
    });
  });

  // --- Editorial flags + category on content ---

  describe('editorial content management', () => {
    it('creates content with a categoryId', async () => {
      const cat = await createContentCategory(db, { name: 'Tutorials', slug: 'tutorials-test' });
      const content = await createContent(db, userId, {
        type: 'blog',
        title: 'Tutorial with Category',
        categoryId: cat.id,
      });

      expect(content).toBeDefined();
      expect(content.categoryId).toBe(cat.id);
      expect(content.categoryName).toBe('Tutorials');
      expect(content.categorySlug).toBe('tutorials-test');
    });

    it('creates content without categoryId (null)', async () => {
      const content = await createContent(db, userId, {
        type: 'blog',
        title: 'Blog Without Category',
      });

      expect(content.categoryId).toBeNull();
      expect(content.categoryName).toBeNull();
    });

    it('admin sets isEditorial on content via direct update', async () => {
      const content = await createContent(db, userId, {
        type: 'blog',
        title: 'Staff Pick Candidate',
      });

      // Simulate admin action (direct DB update like the API route does)
      await db
        .update(contentItems)
        .set({ isEditorial: true, editorialNote: 'Great deep dive on sensors' })
        .where(eq(contentItems.id, content.id));

      const detail = await getContentBySlug(db, content.slug, userId, undefined, userId);
      expect(detail).not.toBeNull();
      expect(detail!.isEditorial).toBe(true);
      expect(detail!.editorialNote).toBe('Great deep dive on sensors');
    });

    it('updates categoryId on existing content', async () => {
      const cat = await createContentCategory(db, { name: 'Deep Dives', slug: 'deep-dives-test' });
      const content = await createContent(db, userId, {
        type: 'blog',
        title: 'Recategorizable Post',
      });

      const updated = await updateContent(db, content.id, userId, {
        categoryId: cat.id,
      });

      expect(updated).not.toBeNull();
      expect(updated!.categoryId).toBe(cat.id);
    });
  });

  // --- Filtering by editorial/category ---

  describe('content filtering', () => {
    let editorialId: string;
    let normalId: string;
    let catId: string;

    beforeAll(async () => {
      const cat = await createContentCategory(db, { name: 'FilterCat', slug: 'filter-cat' });
      catId = cat.id;

      // Create and publish an editorial item
      const editorial = await createContent(db, userId, {
        type: 'project',
        title: 'Editorial Project',
        categoryId: catId,
      });
      await publishContent(db, editorial.id, userId);
      await db
        .update(contentItems)
        .set({ isEditorial: true })
        .where(eq(contentItems.id, editorial.id));
      editorialId = editorial.id;

      // Create and publish a normal item
      const normal = await createContent(db, userId, {
        type: 'project',
        title: 'Normal Project',
      });
      await publishContent(db, normal.id, userId);
      normalId = normal.id;
    });

    it('filters by editorial=true returns only editorial content', async () => {
      const result = await listContent(db, { status: 'published', editorial: true });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      for (const item of result.items) {
        expect(item.isEditorial).toBe(true);
      }
      expect(result.items.some(i => i.id === editorialId)).toBe(true);
      expect(result.items.some(i => i.id === normalId)).toBe(false);
    });

    it('filters by categoryId returns only items in that category', async () => {
      const result = await listContent(db, { status: 'published', categoryId: catId });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      for (const item of result.items) {
        expect(item.categoryId).toBe(catId);
      }
      expect(result.items.some(i => i.id === editorialId)).toBe(true);
      expect(result.items.some(i => i.id === normalId)).toBe(false);
    });

    it('sorts by editorial (editorial items first)', async () => {
      const result = await listContent(db, { status: 'published', sort: 'editorial' });

      expect(result.items.length).toBeGreaterThanOrEqual(2);
      // First item should be editorial
      const firstEditorialIdx = result.items.findIndex(i => i.isEditorial);
      const firstNonEditorialIdx = result.items.findIndex(i => !i.isEditorial);
      if (firstEditorialIdx >= 0 && firstNonEditorialIdx >= 0) {
        expect(firstEditorialIdx).toBeLessThan(firstNonEditorialIdx);
      }
    });

    it('listContent includes category metadata in results', async () => {
      const result = await listContent(db, { status: 'published', categoryId: catId });
      const item = result.items.find(i => i.id === editorialId);

      expect(item).toBeDefined();
      expect(item!.categoryName).toBe('FilterCat');
      expect(item!.categorySlug).toBe('filter-cat');
    });

    it('getContentBySlug includes category metadata', async () => {
      // Need to get the slug for our editorial item
      const result = await listContent(db, { editorial: true });
      const editorialItem = result.items.find(i => i.id === editorialId);
      expect(editorialItem).toBeDefined();

      const detail = await getContentBySlug(db, editorialItem!.slug, userId, undefined, userId);
      expect(detail).not.toBeNull();
      expect(detail!.categoryName).toBe('FilterCat');
      expect(detail!.isEditorial).toBe(true);
    });

    it('editorial/category filters exclude federated content', async () => {
      // When editorial or categoryId is set, federated items should be excluded
      // (tested by passing includeFederated: true with editorial filter)
      const result = await listContent(
        db,
        { status: 'published', editorial: true },
        { includeFederated: true },
      );

      for (const item of result.items) {
        expect(item.source).not.toBe('federated');
      }
    });
  });

  // --- Fork preserves categoryId ---

  describe('fork content', () => {
    it('preserves categoryId when forking', async () => {
      const cat = await createContentCategory(db, { name: 'ForkCat', slug: 'fork-cat' });
      const original = await createContent(db, userId, {
        type: 'project',
        title: 'Forkable Project',
        categoryId: cat.id,
      });
      await publishContent(db, original.id, userId);

      const fork = await forkContent(db, original.id, adminId);
      expect(fork).toBeDefined();
      expect(fork.categoryId).toBe(cat.id);
      expect(fork.categoryName).toBe('ForkCat');
    });
  });

  // --- Category deletion cascades ---

  describe('category deletion effects', () => {
    it('sets categoryId to null when category is deleted (ON DELETE SET NULL)', async () => {
      const cat = await createContentCategory(db, { name: 'Ephemeral', slug: 'ephemeral' });
      const content = await createContent(db, userId, {
        type: 'blog',
        title: 'Content with Ephemeral Category',
        categoryId: cat.id,
      });

      expect(content.categoryId).toBe(cat.id);

      // Delete the category
      const result = await deleteContentCategory(db, cat.id);
      expect(result.deleted).toBe(true);

      // Content should now have null categoryId
      const detail = await getContentBySlug(db, content.slug, userId, undefined, userId);
      expect(detail).not.toBeNull();
      expect(detail!.categoryId).toBeNull();
      expect(detail!.categoryName).toBeNull();
    });
  });
});
