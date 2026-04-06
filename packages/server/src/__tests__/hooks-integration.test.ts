/**
 * Integration tests for hook wiring — verifies that hooks fire when
 * actual business logic functions are called.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { contentItems, hubs, hubMembers } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { onHook, clearHooks } from '../hooks.js';
import type { HookPayloads } from '../hooks.js';
import { createContent, onContentPublished } from '../content/content.js';
import { createComment } from '../social/social.js';
import { createHub } from '../hub/hub.js';
import { joinHub, leaveHub } from '../hub/members.js';
import { createPost } from '../hub/posts.js';

const testConfig: CommonPubConfig = {
  instance: { name: 'Test', domain: 'test.example.com', description: '', contentTypes: ['project', 'article', 'blog'], contestCreation: 'open', maxUploadSize: 10_000_000 },
  features: { content: true, social: true, hubs: true, docs: false, video: false, contests: false, learning: false, explainers: false, federation: false, federateHubs: false, seamlessFederation: false, admin: true, emailNotifications: false },
  auth: { emailPassword: true, magicLink: false, passkeys: false, github: false, google: false, trustedInstances: [] },
};

describe('hook wiring integration', () => {
  let db: DB;
  let userId: string;
  let user2Id: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'hookuser' });
    userId = user.id;
    const user2 = await createTestUser(db, { username: 'hookuser2' });
    user2Id = user2.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  beforeEach(() => {
    clearHooks();
  });

  // --- content:published ---

  describe('content:published hook', () => {
    it('fires when onContentPublished is called', async () => {
      const calls: Array<HookPayloads['content:published']> = [];
      onHook('content:published', async (p) => { calls.push(p); });

      // Create and publish content
      const content = await createContent(db, userId, {
        type: 'project',
        title: 'Hook Test Project',
        slug: 'hook-test-project',
        status: 'published',
      });

      await onContentPublished(db, content.id, testConfig);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.contentId).toBe(content.id);
      expect(calls[0]!.contentType).toBe('project');
      expect(calls[0]!.slug).toBe('hook-test-project');
      expect(calls[0]!.authorId).toBe(userId);
    });
  });

  // --- hub:post:created ---

  describe('hub:post:created hook', () => {
    let hubId: string;

    beforeAll(async () => {
      const hub = await createHub(db, userId, {
        name: 'Hook Test Hub',
        slug: 'hook-test-hub',
      });
      hubId = hub.id;
    });

    it('fires when a hub post is created', async () => {
      const calls: Array<HookPayloads['hub:post:created']> = [];
      onHook('hub:post:created', async (p) => { calls.push(p); });

      const post = await createPost(db, userId, {
        hubId,
        type: 'discussion',
        content: 'Testing hooks',
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]!.postId).toBe(post.id);
      expect(calls[0]!.hubId).toBe(hubId);
      expect(calls[0]!.authorId).toBe(userId);
      expect(calls[0]!.postType).toBe('discussion');
    });
  });

  // --- hub:member:joined ---

  describe('hub:member:joined hook', () => {
    let hubId: string;

    beforeAll(async () => {
      const hub = await createHub(db, userId, {
        name: 'Join Hook Hub',
        slug: 'join-hook-hub',
      });
      hubId = hub.id;
    });

    it('fires when a user joins a hub', async () => {
      const calls: Array<HookPayloads['hub:member:joined']> = [];
      onHook('hub:member:joined', async (p) => { calls.push(p); });

      await joinHub(db, user2Id, hubId);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.hubId).toBe(hubId);
      expect(calls[0]!.userId).toBe(user2Id);
      expect(calls[0]!.role).toBe('member');
    });
  });

  // --- hub:member:left ---

  describe('hub:member:left hook', () => {
    it('fires when a user leaves a hub', async () => {
      // user2 joined in the previous test — now leave
      const hub = await db.select({ id: hubs.id }).from(hubs).where(eq(hubs.slug, 'join-hook-hub')).limit(1);
      const hubId = hub[0]!.id;

      const calls: Array<HookPayloads['hub:member:left']> = [];
      onHook('hub:member:left', async (p) => { calls.push(p); });

      await leaveHub(db, user2Id, hubId);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.hubId).toBe(hubId);
      expect(calls[0]!.userId).toBe(user2Id);
    });
  });

  // --- comment:created ---

  describe('comment:created hook', () => {
    it('fires when a comment is created on content', async () => {
      const calls: Array<HookPayloads['comment:created']> = [];
      onHook('comment:created', async (p) => { calls.push(p); });

      // Create content to comment on
      const content = await createContent(db, userId, {
        type: 'article',
        title: 'Comment Hook Article',
        slug: 'comment-hook-article',
        status: 'published',
      });

      const comment = await createComment(db, user2Id, {
        targetType: 'article',
        targetId: content.id,
        content: 'Great article!',
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]!.commentId).toBe(comment.id);
      expect(calls[0]!.authorId).toBe(user2Id);
      expect(calls[0]!.targetType).toBe('article');
      expect(calls[0]!.targetId).toBe(content.id);
    });
  });

  // --- hooks don't fire when no handlers registered ---

  describe('no handlers', () => {
    it('does not error when no hooks are registered', async () => {
      const content = await createContent(db, userId, {
        type: 'article',
        title: 'No Hooks Article',
        slug: 'no-hooks-article',
        status: 'published',
      });

      // Should not throw even with no hooks registered
      await expect(onContentPublished(db, content.id, testConfig)).resolves.toBeDefined();
    });
  });
});
