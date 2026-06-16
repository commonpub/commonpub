import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  listVideos,
  getVideoById,
  createVideo,
  listVideoCategories,
  createVideoCategory,
  updateVideoCategory,
  deleteVideoCategory,
  incrementVideoViewCount,
} from '../video/video.js';

describe('video', () => {
  let db: DB;
  let authorId: string;
  let otherAuthorId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const author = await createTestUser(db, { username: 'videocreator', displayName: 'Video Creator' });
    authorId = author.id;
    const other = await createTestUser(db, { username: 'othervideocreator' });
    otherAuthorId = other.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('video CRUD', () => {
    it('creates a video', async () => {
      const video = await createVideo(db, {
        title: 'Getting Started with Arduino',
        url: 'https://www.youtube.com/watch?v=abc123',
        description: 'A beginner guide to Arduino',
        embedUrl: 'https://www.youtube-nocookie.com/embed/abc123',
        platform: 'youtube',
        authorId,
      });
      expect(video.id).toBeDefined();
      expect(video.title).toBe('Getting Started with Arduino');
      expect(video.url).toBe('https://www.youtube.com/watch?v=abc123');
      expect(video.platform).toBe('youtube');
      expect(video.viewCount).toBe(0);
      expect(video.authorName).toBe('Video Creator');
      expect(video.authorUsername).toBe('videocreator');
    });

    it('persists categoryId on create (was dropped before reaching createVideo)', async () => {
      const cat = await createVideoCategory(db, { name: 'Tutorials Cat' });
      const video = await createVideo(db, {
        title: 'Categorized Video',
        url: 'https://example.com/categorized',
        authorId,
        categoryId: cat.id,
      });
      expect(video.categoryId).toBe(cat.id);

      const fetched = await getVideoById(db, video.id);
      expect(fetched!.categoryId).toBe(cat.id);
    });

    it('creates a video with minimal fields', async () => {
      const video = await createVideo(db, {
        title: 'Quick Demo',
        url: 'https://vimeo.com/12345',
        authorId,
      });
      expect(video.id).toBeDefined();
      expect(video.description).toBeNull();
      expect(video.embedUrl).toBeNull();
    });

    it('gets a video by ID', async () => {
      const created = await createVideo(db, {
        title: 'Fetch Test',
        url: 'https://example.com/video',
        authorId,
      });
      const fetched = await getVideoById(db, created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.title).toBe('Fetch Test');
    });

    it('returns null for non-existent video', async () => {
      const result = await getVideoById(db, '00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });

    it('lists videos with pagination', async () => {
      const { items, total } = await listVideos(db, { limit: 2, offset: 0 });
      expect(items.length).toBeLessThanOrEqual(2);
      expect(total).toBeGreaterThanOrEqual(items.length);
    });

    it('filters videos by authorId', async () => {
      await createVideo(db, {
        title: 'Other Author Video',
        url: 'https://example.com/other',
        authorId: otherAuthorId,
      });
      const { items } = await listVideos(db, { authorId });
      expect(items.every((v) => v.authorId === authorId)).toBe(true);
    });

    it('lists videos ordered by createdAt DESC', async () => {
      const { items } = await listVideos(db);
      for (let i = 1; i < items.length; i++) {
        expect(items[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(items[i]!.createdAt.getTime());
      }
    });

    it('increments video view count', async () => {
      const video = await createVideo(db, {
        title: 'View Counter',
        url: 'https://example.com/views',
        authorId,
      });
      expect(video.viewCount).toBe(0);

      await incrementVideoViewCount(db, video.id);
      await incrementVideoViewCount(db, video.id);
      await incrementVideoViewCount(db, video.id);

      const updated = await getVideoById(db, video.id);
      expect(updated!.viewCount).toBe(3);
    });
  });

  describe('video categories', () => {
    it('creates a category with slug', async () => {
      const cat = await createVideoCategory(db, {
        name: 'Electronics Tutorials',
      });
      expect(cat.id).toBeDefined();
      expect(cat.name).toBe('Electronics Tutorials');
      expect(cat.slug).toBe('electronics-tutorials');
    });

    it('creates a category with sort order', async () => {
      const cat = await createVideoCategory(db, {
        name: 'Woodworking',
        sortOrder: 5,
      });
      expect(cat.slug).toBe('woodworking');
    });

    it('lists categories ordered by sortOrder', async () => {
      const cats = await listVideoCategories(db);
      expect(cats.length).toBeGreaterThan(0);
      for (let i = 1; i < cats.length; i++) {
        // Should be ordered (ascending)
        expect(cats[i - 1]).toBeDefined();
      }
    });

    it('updates a category name and regenerates slug', async () => {
      const cat = await createVideoCategory(db, { name: 'Old Name' });
      const updated = await updateVideoCategory(db, cat.id, { name: 'New Name' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New Name');
      expect(updated!.slug).toBe('new-name');
    });

    it('updates category description only', async () => {
      const cat = await createVideoCategory(db, { name: 'DescTest' });
      const updated = await updateVideoCategory(db, cat.id, { description: 'Updated desc' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('DescTest');
    });

    it('returns null when updating non-existent category', async () => {
      const result = await updateVideoCategory(db, '00000000-0000-0000-0000-000000000000', { name: 'X' });
      expect(result).toBeNull();
    });

    it('deletes a category', async () => {
      const cat = await createVideoCategory(db, { name: 'ToDelete' });
      const deleted = await deleteVideoCategory(db, cat.id);
      expect(deleted).toBe(true);
    });

    it('returns false when deleting non-existent category', async () => {
      const result = await deleteVideoCategory(db, '00000000-0000-0000-0000-000000000000');
      expect(result).toBe(false);
    });
  });
});
