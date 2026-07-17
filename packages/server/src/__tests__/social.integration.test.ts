import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { contentItems } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createContent } from '../content/content.js';
import {
  toggleLike,
  isLiked,
  createComment,
  listComments,
  deleteComment,
  toggleBookmark,
  followUser,
  unfollowUser,
  isFollowing,
  listFollowers,
  listFollowing,
  listUserBookmarks,
} from '../social/social.js';

describe('social integration', () => {
  let db: DB;
  let userA: string;
  let userB: string;
  let contentId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const a = await createTestUser(db, { username: 'alice' });
    const b = await createTestUser(db, { username: 'bob' });
    userA = a.id;
    userB = b.id;

    const content = await createContent(db, userA, {
      type: 'article',
      title: 'Social Test Article',
    });
    // Publish it: listComments now gates on the parent's read-visibility (P-1), so an
    // unauthenticated listing only returns comments on a published+public item.
    await db
      .update(contentItems)
      .set({ status: 'published', publishedAt: new Date() })
      .where(eq(contentItems.id, content.id));
    contentId = content.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('likes', () => {
    it('toggles like on', async () => {
      const result = await toggleLike(db, userB, 'article', contentId);
      expect(result.liked).toBe(true);
    });

    it('checks if liked', async () => {
      const liked = await isLiked(db, userB, 'article', contentId);
      expect(liked).toBe(true);
    });

    it('toggles like off', async () => {
      const result = await toggleLike(db, userB, 'article', contentId);
      expect(result.liked).toBe(false);
    });
  });

  describe('comments', () => {
    it('creates a comment', async () => {
      const comment = await createComment(db, userB, {
        targetType: 'article',
        targetId: contentId,
        content: 'Great article!',
      });

      expect(comment).toBeDefined();
      expect(comment.content).toBe('Great article!');
    });

    it('lists comments with threading', async () => {
      const comments = await listComments(db, 'article', contentId);
      expect(comments.length).toBeGreaterThanOrEqual(1);
    });

    it('creates threaded reply', async () => {
      const parent = await createComment(db, userA, {
        targetType: 'article',
        targetId: contentId,
        content: 'Parent comment',
      });

      const reply = await createComment(db, userB, {
        targetType: 'article',
        targetId: contentId,
        parentId: parent.id,
        content: 'Reply to parent',
      });

      expect(reply.parentId).toBe(parent.id);
    });

    // Session 242 audit (#22): a reply must attach to a parent on the SAME target. A
    // cross-target parentId was previously accepted — invisible in threading yet still
    // incrementing the count (counted > displayed). It must now be rejected.
    it('rejects a reply whose parentId belongs to a different target', async () => {
      const other = await createContent(db, userA, { type: 'article', title: 'Other Article' });
      await db
        .update(contentItems)
        .set({ status: 'published', publishedAt: new Date() })
        .where(eq(contentItems.id, other.id));

      const foreignParent = await createComment(db, userA, {
        targetType: 'article',
        targetId: other.id,
        content: 'Parent on a different article',
      });

      await expect(
        createComment(db, userB, {
          targetType: 'article',
          targetId: contentId,
          parentId: foreignParent.id,
          content: 'Reply pointing at a foreign parent',
        }),
      ).rejects.toThrow(/does not belong to this target/);
    });

    it('deletes own comment', async () => {
      const comment = await createComment(db, userA, {
        targetType: 'article',
        targetId: contentId,
        content: 'To be deleted',
      });

      await deleteComment(db, comment.id, userA);
      const comments = await listComments(db, 'article', contentId);
      const found = comments.find((c) => c.id === comment.id);
      expect(found).toBeUndefined();
    });
  });

  describe('bookmarks', () => {
    it('toggles bookmark on', async () => {
      const result = await toggleBookmark(db, userA, 'article', contentId);
      expect(result.bookmarked).toBe(true);
    });

    it('lists user bookmarks', async () => {
      const result = await listUserBookmarks(db, userA);
      const bookmarks = Array.isArray(result) ? result : (result as { items: unknown[] }).items ?? [];
      expect(bookmarks.length).toBeGreaterThanOrEqual(1);
    });

    it('toggles bookmark off', async () => {
      const result = await toggleBookmark(db, userA, 'article', contentId);
      expect(result.bookmarked).toBe(false);
    });
  });

  describe('follows', () => {
    it('follows a user', async () => {
      await followUser(db, userA, userB);
      const following = await isFollowing(db, userA, userB);
      expect(following).toBe(true);
    });

    it('lists followers', async () => {
      const result = await listFollowers(db, userB);
      const followers = Array.isArray(result) ? result : (result as { items: { id: string }[] }).items ?? [];
      expect(followers.some((f: { id: string }) => f.id === userA)).toBe(true);
    });

    it('lists following', async () => {
      const result = await listFollowing(db, userA);
      const following = Array.isArray(result) ? result : (result as { items: { id: string }[] }).items ?? [];
      expect(following.some((f: { id: string }) => f.id === userB)).toBe(true);
    });

    it('annotates isFollowing for the viewer, not the profile owner', async () => {
      const carol = await createTestUser(db, { username: 'carol' });
      const dave = await createTestUser(db, { username: 'dave' });
      await followUser(db, dave.id, carol.id); // dave follows carol → dave is one of carol's followers
      await followUser(db, userA, dave.id);    // alice (the viewer) follows dave
      // Viewer alice follows dave → the dave row is marked isFollowing.
      const asAlice = await listFollowers(db, carol.id, {}, userA);
      expect(asAlice.items.find((u) => u.username === 'dave')?.isFollowing).toBe(true);
      // Viewer bob does NOT follow dave → false (proves it reflects the VIEWER, not the owner).
      const asBob = await listFollowers(db, carol.id, {}, userB);
      expect(asBob.items.find((u) => u.username === 'dave')?.isFollowing).toBe(false);
      // No viewer → field omitted.
      const anon = await listFollowers(db, carol.id, {});
      expect(anon.items.find((u) => u.username === 'dave')?.isFollowing).toBeUndefined();
    });

    it('unfollows a user', async () => {
      await unfollowUser(db, userA, userB);
      const following = await isFollowing(db, userA, userB);
      expect(following).toBe(false);
    });
  });
});
