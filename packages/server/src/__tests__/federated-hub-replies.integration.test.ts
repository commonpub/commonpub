/**
 * Integration tests for federated hub post replies.
 *
 * Tests:
 * - Remote Create(Note) with inReplyTo hub post stores reply with remote actor info
 * - Reply count incremented on the parent hub post
 * - listReplies returns both local and federated replies with correct author info
 * - Federated replies have null authorId + remoteActorUri/remoteActorName
 * - deleteReply works for mods on federated replies
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  hubs,
  hubMembers,
  hubPosts,
  hubPostReplies,
  remoteActors,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createInboxHandlers } from '../federation/inboxHandlers.js';
import { createReply, listReplies, deleteReply } from '../hub/posts.js';

const LOCAL_DOMAIN = 'reply-test.example.com';
const REMOTE_DOMAIN = 'remote.example.com';
const REMOTE_ACTOR = `https://${REMOTE_DOMAIN}/users/bob`;

describe('federated hub post replies', () => {
  let db: DB;
  let userId: string;
  let hubId: string;
  let hubSlug: string;
  let postId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'localmod' });
    userId = user.id;

    // Create a hub
    const [hub] = await db.insert(hubs).values({
      name: 'Test Hub',
      slug: 'test-hub',
      description: 'A test hub',
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

    // Create a hub post
    const [post] = await db.insert(hubPosts).values({
      hubId,
      authorId: userId,
      type: 'text',
      content: 'Test post for federation replies',
    }).returning();
    postId = post!.id;

    // Pre-populate remote actor
    await db.insert(remoteActors).values({
      actorUri: REMOTE_ACTOR,
      inbox: `${REMOTE_ACTOR}/inbox`,
      instanceDomain: REMOTE_DOMAIN,
      preferredUsername: 'bob',
      displayName: 'Bob Remote',
    });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('inbound federated reply via onCreate', () => {
    it('stores reply with remote actor info when receiving Create(Note) inReplyTo hub post', async () => {
      const handlers = createInboxHandlers({ db, domain: LOCAL_DOMAIN });

      // Simulate a Create(Note) that is a reply to our local hub post
      const noteObject = {
        id: `https://${REMOTE_DOMAIN}/notes/reply-1`,
        type: 'Note',
        content: '<p>Great post! Here is my take on it.</p>',
        inReplyTo: `https://${LOCAL_DOMAIN}/hubs/${hubSlug}/posts/${postId}`,
        attributedTo: REMOTE_ACTOR,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [],
        published: new Date().toISOString(),
      };

      await handlers.onCreate(REMOTE_ACTOR, noteObject);

      // Verify reply was inserted
      const replies = await db
        .select()
        .from(hubPostReplies)
        .where(eq(hubPostReplies.postId, postId));

      const federatedReply = replies.find(r => r.remoteActorUri === REMOTE_ACTOR);
      expect(federatedReply).toBeDefined();
      expect(federatedReply!.authorId).toBeNull();
      expect(federatedReply!.remoteActorUri).toBe(REMOTE_ACTOR);
      expect(federatedReply!.remoteActorName).toBe('Bob Remote');
      expect(federatedReply!.content).toContain('Great post');
    });

    it('increments reply count on the parent hub post', async () => {
      const [post] = await db
        .select({ replyCount: hubPosts.replyCount })
        .from(hubPosts)
        .where(eq(hubPosts.id, postId));

      expect(post!.replyCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('listReplies includes federated replies', () => {
    it('local + federated replies are returned with correct author info', async () => {
      // Create a local reply first
      const localReply = await createReply(db, userId, {
        postId,
        content: 'This is a local reply',
      });

      expect(localReply.author).not.toBeNull();
      expect(localReply.author!.username).toBe('localmod');

      // List all replies
      const result = await listReplies(db, postId);

      expect(result.total).toBeGreaterThanOrEqual(2);

      // Find the federated reply
      const fedReply = result.items.find(r => r.remoteActorUri === REMOTE_ACTOR);
      expect(fedReply).toBeDefined();
      expect(fedReply!.author).toBeNull();
      expect(fedReply!.remoteActorName).toBe('Bob Remote');

      // Find the local reply
      const locReply = result.items.find(r => r.author?.username === 'localmod');
      expect(locReply).toBeDefined();
      expect(locReply!.remoteActorUri).toBeNull();
    });
  });

  describe('deleteReply on federated replies', () => {
    it('mod can delete a federated reply', async () => {
      // Get the federated reply
      const allReplies = await db
        .select()
        .from(hubPostReplies)
        .where(eq(hubPostReplies.postId, postId));

      const fedReply = allReplies.find(r => r.remoteActorUri === REMOTE_ACTOR);
      expect(fedReply).toBeDefined();

      // Mod (owner) deletes the federated reply
      const deleted = await deleteReply(db, fedReply!.id, userId, hubId);
      expect(deleted).toBe(true);

      // Verify it's gone
      const remaining = await db
        .select()
        .from(hubPostReplies)
        .where(eq(hubPostReplies.postId, postId));

      const stillThere = remaining.find(r => r.id === fedReply!.id);
      expect(stillThere).toBeUndefined();
    });
  });

  describe('empty content is not stored and count not incremented', () => {
    it('does not insert reply or increment count when remote note has empty content', async () => {
      const handlers = createInboxHandlers({ db, domain: LOCAL_DOMAIN });

      const replyCountBefore = (await db.select().from(hubPostReplies).where(eq(hubPostReplies.postId, postId))).length;
      const [postBefore] = await db.select({ replyCount: hubPosts.replyCount }).from(hubPosts).where(eq(hubPosts.id, postId));

      await handlers.onCreate(REMOTE_ACTOR, {
        id: `https://${REMOTE_DOMAIN}/notes/empty-reply`,
        type: 'Note',
        content: '',
        inReplyTo: `https://${LOCAL_DOMAIN}/hubs/${hubSlug}/posts/${postId}`,
        attributedTo: REMOTE_ACTOR,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [],
      });

      const replyCountAfter = (await db.select().from(hubPostReplies).where(eq(hubPostReplies.postId, postId))).length;
      const [postAfter] = await db.select({ replyCount: hubPosts.replyCount }).from(hubPosts).where(eq(hubPosts.id, postId));

      expect(replyCountAfter).toBe(replyCountBefore);
      expect(postAfter!.replyCount).toBe(postBefore!.replyCount);
    });
  });

  describe('HTML sanitization', () => {
    it('strips dangerous HTML from federated reply content', async () => {
      const handlers = createInboxHandlers({ db, domain: LOCAL_DOMAIN });

      await handlers.onCreate(REMOTE_ACTOR, {
        id: `https://${REMOTE_DOMAIN}/notes/xss-reply`,
        type: 'Note',
        content: '<p>Nice post!</p><script>alert("xss")</script><img onerror="alert(1)" src="x">',
        inReplyTo: `https://${LOCAL_DOMAIN}/hubs/${hubSlug}/posts/${postId}`,
        attributedTo: REMOTE_ACTOR,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [],
      });

      const replies = await db
        .select()
        .from(hubPostReplies)
        .where(eq(hubPostReplies.postId, postId));

      const xssReply = replies.find(r => r.remoteActorUri === REMOTE_ACTOR && r.content.includes('Nice post'));
      expect(xssReply).toBeDefined();
      expect(xssReply!.content).not.toContain('<script>');
      expect(xssReply!.content).not.toContain('onerror');
      expect(xssReply!.content).toContain('Nice post');
    });
  });
});
