/**
 * Integration tests for remote member posts on host hub.
 *
 * Tests:
 * - When a remote follower sends Create(Note) to a hub inbox, a local hub post is created
 * - Post has null authorId + remoteActorUri/remoteActorName
 * - Hub post count is incremented
 * - Non-followers are rejected (no post created)
 * - listPosts returns both local and federated posts with correct author info
 * - deletePost works for mods on federated posts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  hubs,
  hubMembers,
  hubPosts,
  hubFollowers,
  remoteActors,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createInboxHandlers } from '../federation/inboxHandlers.js';
import { listPosts, deletePost } from '../hub/posts.js';

const LOCAL_DOMAIN = 'hub-member-post.example.com';
const REMOTE_DOMAIN = 'remote.example.com';
const REMOTE_ACTOR = `https://${REMOTE_DOMAIN}/users/charlie`;

describe('remote member posts on host hub', () => {
  let db: DB;
  let userId: string;
  let hubId: string;
  let hubSlug: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'hubadmin' });
    userId = user.id;

    // Create a hub
    const [hub] = await db.insert(hubs).values({
      name: 'Makers Hub',
      slug: 'makers',
      description: 'A maker hub',
      hubType: 'community',
      privacy: 'public',
      joinPolicy: 'open',
      createdById: userId,
    }).returning();
    hubId = hub!.id;
    hubSlug = hub!.slug;

    // Add user as hub owner
    await db.insert(hubMembers).values({
      hubId,
      userId,
      role: 'owner',
    });

    // Pre-populate remote actor
    await db.insert(remoteActors).values({
      actorUri: REMOTE_ACTOR,
      inbox: `${REMOTE_ACTOR}/inbox`,
      instanceDomain: REMOTE_DOMAIN,
      preferredUsername: 'charlie',
      displayName: 'Charlie Remote',
    });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('non-follower is rejected', () => {
    it('does not create a post from an unknown actor', async () => {
      const handlers = createInboxHandlers({
        db,
        domain: LOCAL_DOMAIN,
        hubContext: { hubSlug },
      });

      const countBefore = (await db.select().from(hubPosts).where(eq(hubPosts.hubId, hubId))).length;

      await handlers.onCreate(`https://${REMOTE_DOMAIN}/users/stranger`, {
        id: `https://${REMOTE_DOMAIN}/notes/stranger-post`,
        type: 'Note',
        content: '<p>Unauthorized post</p>',
        attributedTo: `https://${REMOTE_DOMAIN}/users/stranger`,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [],
        published: new Date().toISOString(),
      });

      const countAfter = (await db.select().from(hubPosts).where(eq(hubPosts.hubId, hubId))).length;
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('accepted follower can post', () => {
    it('creates a local hub post from a remote follower Create(Note)', async () => {
      // Make Charlie an accepted follower of the hub
      await db.insert(hubFollowers).values({
        hubId,
        followerActorUri: REMOTE_ACTOR,
        status: 'accepted',
      });

      const handlers = createInboxHandlers({
        db,
        domain: LOCAL_DOMAIN,
        hubContext: { hubSlug },
      });

      await handlers.onCreate(REMOTE_ACTOR, {
        id: `https://${REMOTE_DOMAIN}/notes/charlie-post-1`,
        type: 'Note',
        content: '<p>Just finished my LED cube project!</p>',
        attributedTo: REMOTE_ACTOR,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [],
        published: new Date().toISOString(),
      });

      // Verify post was created
      const posts = await db
        .select()
        .from(hubPosts)
        .where(eq(hubPosts.hubId, hubId));

      const remotePost = posts.find(p => p.remoteActorUri === REMOTE_ACTOR);
      expect(remotePost).toBeDefined();
      expect(remotePost!.authorId).toBeNull();
      expect(remotePost!.remoteActorName).toBe('Charlie Remote');
      expect(remotePost!.content).toContain('LED cube');
    });

    it('increments hub post count', async () => {
      const [hub] = await db
        .select({ postCount: hubs.postCount })
        .from(hubs)
        .where(eq(hubs.id, hubId));

      expect(hub!.postCount).toBeGreaterThanOrEqual(1);
    });

    it('post with cpub:postType is preserved', async () => {
      const handlers = createInboxHandlers({
        db,
        domain: LOCAL_DOMAIN,
        hubContext: { hubSlug },
      });

      await handlers.onCreate(REMOTE_ACTOR, {
        id: `https://${REMOTE_DOMAIN}/notes/charlie-showcase`,
        type: 'Note',
        content: '<p>Check out my finished build!</p>',
        attributedTo: REMOTE_ACTOR,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [],
        'cpub:postType': 'showcase',
        published: new Date().toISOString(),
      });

      const posts = await db
        .select()
        .from(hubPosts)
        .where(eq(hubPosts.hubId, hubId));

      const showcasePost = posts.find(p => p.content.includes('finished build'));
      expect(showcasePost).toBeDefined();
      expect(showcasePost!.type).toBe('showcase');
    });
  });

  describe('listPosts includes federated posts', () => {
    it('returns both local and federated posts with correct author info', async () => {
      // Create a local post
      await db.insert(hubPosts).values({
        hubId,
        authorId: userId,
        type: 'text',
        content: 'Local post from admin',
      });

      const result = await listPosts(db, hubId);

      // Should have at least 3 posts (2 remote + 1 local)
      expect(result.total).toBeGreaterThanOrEqual(3);

      const localPost = result.items.find(p => p.author?.username === 'hubadmin');
      expect(localPost).toBeDefined();
      expect(localPost!.remoteActorUri).toBeNull();

      const remotePost = result.items.find(p => p.remoteActorUri === REMOTE_ACTOR);
      expect(remotePost).toBeDefined();
      expect(remotePost!.author).toBeNull();
      expect(remotePost!.remoteActorName).toBe('Charlie Remote');
    });
  });

  describe('idempotency — duplicate Create(Note) is ignored', () => {
    it('does not create a second post when same activity is delivered twice', async () => {
      const handlers = createInboxHandlers({
        db,
        domain: LOCAL_DOMAIN,
        hubContext: { hubSlug },
      });

      const noteId = `https://${REMOTE_DOMAIN}/notes/charlie-idempotent`;

      await handlers.onCreate(REMOTE_ACTOR, {
        id: noteId,
        type: 'Note',
        content: '<p>This should only appear once</p>',
        attributedTo: REMOTE_ACTOR,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [],
        published: new Date().toISOString(),
      });

      const countAfterFirst = (await db.select().from(hubPosts).where(eq(hubPosts.hubId, hubId))).length;

      // Deliver the same activity again (AP retry)
      await handlers.onCreate(REMOTE_ACTOR, {
        id: noteId,
        type: 'Note',
        content: '<p>This should only appear once</p>',
        attributedTo: REMOTE_ACTOR,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [],
        published: new Date().toISOString(),
      });

      const countAfterSecond = (await db.select().from(hubPosts).where(eq(hubPosts.hubId, hubId))).length;

      expect(countAfterSecond).toBe(countAfterFirst);
    });
  });

  describe('reply Notes are not treated as hub posts', () => {
    it('Note with inReplyTo is not stored as a hub post', async () => {
      const handlers = createInboxHandlers({
        db,
        domain: LOCAL_DOMAIN,
        hubContext: { hubSlug },
      });

      const countBefore = (await db.select().from(hubPosts).where(eq(hubPosts.hubId, hubId))).length;

      // Create(Note) with inReplyTo — should not create a hub post
      await handlers.onCreate(REMOTE_ACTOR, {
        id: `https://${REMOTE_DOMAIN}/notes/charlie-reply-to-content`,
        type: 'Note',
        content: '<p>This is a reply to content, not a new post</p>',
        inReplyTo: `https://${REMOTE_DOMAIN}/users/alice/posts/123`,
        attributedTo: REMOTE_ACTOR,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [],
        published: new Date().toISOString(),
      });

      const countAfter = (await db.select().from(hubPosts).where(eq(hubPosts.hubId, hubId))).length;

      // No hub post should be created — this is a reply, not a new post
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('invalid cpub:postType falls back to text', () => {
    it('creates post with type text when cpub:postType is invalid', async () => {
      const handlers = createInboxHandlers({
        db,
        domain: LOCAL_DOMAIN,
        hubContext: { hubSlug },
      });

      await handlers.onCreate(REMOTE_ACTOR, {
        id: `https://${REMOTE_DOMAIN}/notes/charlie-bad-type`,
        type: 'Note',
        content: '<p>Post with invalid type</p>',
        attributedTo: REMOTE_ACTOR,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [],
        'cpub:postType': 'invalid_type_value',
        published: new Date().toISOString(),
      });

      const posts = await db.select().from(hubPosts).where(eq(hubPosts.hubId, hubId));
      const invalidTypePost = posts.find(p => p.content.includes('invalid type'));
      expect(invalidTypePost).toBeDefined();
      expect(invalidTypePost!.type).toBe('text');
    });
  });

  describe('mod can delete federated posts', () => {
    it('owner can delete a federated post', async () => {
      const posts = await db
        .select()
        .from(hubPosts)
        .where(eq(hubPosts.hubId, hubId));

      const remotePost = posts.find(p => p.remoteActorUri === REMOTE_ACTOR);
      expect(remotePost).toBeDefined();

      const deleted = await deletePost(db, remotePost!.id, userId, hubId);
      expect(deleted).toBe(true);
    });
  });
});
