/**
 * Federated timeline integration tests.
 * Tests inbound content storage, timeline queries, and remote interactions.
 * Covers: all content types, loop prevention, sanitization, like/boost.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createInboxHandlers } from '../federation/inboxHandlers.js';
import {
  listFederatedTimeline,
  getFederatedContent,
  likeRemoteContent,
  boostRemoteContent,
  federateReply,
  listRemoteReplies,
} from '../federation/timeline.js';
import { listFederationActivity, getOrCreateActorKeypair } from '../federation/federation.js';
import { remoteActors, federatedContent } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

const DOMAIN = 'local.example.com';
const REMOTE_DOMAIN = 'remote.example.com';
const REMOTE_ALICE = `https://${REMOTE_DOMAIN}/users/alice`;
const REMOTE_BOB = `https://${REMOTE_DOMAIN}/users/bob`;

describe('federated timeline integration', () => {
  let db: DB;
  let userId: string;
  let handlers: ReturnType<typeof createInboxHandlers>;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'timelineuser' });
    userId = user.id;
    await getOrCreateActorKeypair(db, userId);

    // Pre-populate remote actors
    for (const [uri, name] of [[REMOTE_ALICE, 'alice'], [REMOTE_BOB, 'bob']] as const) {
      await db.insert(remoteActors).values({
        actorUri: uri,
        inbox: `https://${REMOTE_DOMAIN}/users/${name}/inbox`,
        instanceDomain: REMOTE_DOMAIN,
        preferredUsername: name,
        displayName: name === 'alice' ? 'Alice Remote' : 'Bob Remote',
        avatarUrl: `https://${REMOTE_DOMAIN}/avatars/${name}.png`,
      });
    }

    handlers = createInboxHandlers({ db, domain: DOMAIN, autoAcceptFollows: true });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('inbound Create → content storage', () => {
    it('stores an Article with all fields', async () => {
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: `https://${REMOTE_DOMAIN}/content/arduino-robot`,
        name: 'Building a Robot',
        content: '<p>Step 1: Get an Arduino</p>',
        summary: 'A robot building guide',
        url: `https://${REMOTE_DOMAIN}/project/arduino-robot`,
        published: '2026-03-20T12:00:00Z',
        tag: [
          { type: 'Hashtag', name: '#arduino' },
          { type: 'Hashtag', name: '#robotics' },
        ],
        attachment: [
          { type: 'Image', url: `https://${REMOTE_DOMAIN}/images/robot.jpg`, name: 'Robot photo' },
        ],
        attributedTo: REMOTE_ALICE,
      });

      const { items } = await listFederatedTimeline(db);
      const item = items.find((i) => i.objectUri.includes('arduino-robot'));
      expect(item).toBeDefined();
      expect(item!.title).toBe('Building a Robot');
      expect(item!.apType).toBe('Article');
      expect(item!.summary).toBe('A robot building guide');
      expect(item!.originDomain).toBe(REMOTE_DOMAIN);
      expect(item!.tags).toHaveLength(2);
      expect(item!.tags[0]!.name).toBe('#arduino');
      expect(item!.attachments).toHaveLength(1);
      expect(item!.coverImageUrl).toBe(`https://${REMOTE_DOMAIN}/images/robot.jpg`);
      expect(item!.publishedAt).toBe('2026-03-20T12:00:00.000Z');
      expect(item!.actor).not.toBeNull();
      expect(item!.actor!.preferredUsername).toBe('alice');
      expect(item!.actor!.displayName).toBe('Alice Remote');
    });

    it('stores a Note (short post)', async () => {
      await handlers.onCreate(REMOTE_BOB, {
        type: 'Note',
        id: `https://${REMOTE_DOMAIN}/notes/status-1`,
        content: '<p>Just finished soldering!</p>',
        published: '2026-03-21T08:00:00Z',
        attributedTo: REMOTE_BOB,
      });

      const { items } = await listFederatedTimeline(db, { apType: 'Note' });
      const item = items.find((i) => i.objectUri.includes('status-1'));
      expect(item).toBeDefined();
      expect(item!.apType).toBe('Note');
      expect(item!.title).toBeNull();
      expect(item!.actor!.preferredUsername).toBe('bob');
    });

    it('stores CommonPub-typed content with cpub:type and cpub:metadata', async () => {
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: `https://${REMOTE_DOMAIN}/content/cpub-project`,
        name: 'CommonPub Project',
        content: '<p>A project with BOM</p>',
        'cpub:type': 'project',
        'cpub:metadata': { difficulty: 'intermediate', buildTime: '4h' },
        attributedTo: REMOTE_ALICE,
      });

      const { items } = await listFederatedTimeline(db, { cpubType: 'project' });
      expect(items.length).toBeGreaterThanOrEqual(1);
      const item = items.find((i) => i.objectUri.includes('cpub-project'));
      expect(item).toBeDefined();
      expect(item!.cpubType).toBe('project');
    });

    it('sanitizes HTML content (strips dangerous tags)', async () => {
      await handlers.onCreate(REMOTE_BOB, {
        type: 'Article',
        id: `https://${REMOTE_DOMAIN}/content/xss-test`,
        name: 'XSS Test',
        content: '<p>Safe</p><script>alert("xss")</script><img src=x onerror="alert(1)">',
        summary: '<b>Bold</b><script>evil()</script>',
        attributedTo: REMOTE_BOB,
      });

      const { items } = await listFederatedTimeline(db);
      const item = items.find((i) => i.objectUri.includes('xss-test'));
      expect(item).toBeDefined();
      // Script tags must be stripped
      expect(item!.content).not.toContain('<script>');
      expect(item!.content).not.toContain('onerror');
      expect(item!.content).toContain('Safe');
      // Summary also sanitized
      expect(item!.summary).not.toContain('<script>');
    });

    it('deduplicates on objectUri (upsert)', async () => {
      const objectUri = `https://${REMOTE_DOMAIN}/content/dedup-test`;

      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Version 1',
        content: '<p>First version</p>',
        attributedTo: REMOTE_ALICE,
      });

      // Send same objectUri again with different title
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Version 2',
        content: '<p>Updated version</p>',
        attributedTo: REMOTE_ALICE,
      });

      // Should have only one row for this URI
      const rows = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, objectUri));
      expect(rows).toHaveLength(1);
      // Should have the updated title from the upsert
      expect(rows[0]!.title).toBe('Version 2');
    });
  });

  describe('loop prevention', () => {
    it('rejects content from our own domain (no echo)', async () => {
      const localObjectUri = `https://${DOMAIN}/content/own-content`;
      const beforeCount = (await listFederatedTimeline(db)).total;

      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: localObjectUri,
        name: 'This Should Not Be Stored',
        content: '<p>Echoed back</p>',
        attributedTo: REMOTE_ALICE,
      });

      // Content should NOT be stored (it originated from our domain)
      const rows = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, localObjectUri));
      expect(rows).toHaveLength(0);

      // Activity is still logged (for audit) but content is not stored
      const activities = await listFederationActivity(db, { type: 'Create', direction: 'inbound' });
      const activity = activities.items.find((a) => a.objectUri === localObjectUri);
      expect(activity).toBeDefined();
    });
  });

  describe('inbound Update', () => {
    it('updates existing federated content', async () => {
      const objectUri = `https://${REMOTE_DOMAIN}/content/update-test`;
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Original Title',
        content: '<p>Original</p>',
        attributedTo: REMOTE_ALICE,
      });

      // Send Update
      await handlers.onUpdate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Updated Title',
        content: '<p>Updated content</p>',
        summary: 'New summary',
      });

      const [row] = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, objectUri));
      expect(row!.title).toBe('Updated Title');
      expect(row!.content).toContain('Updated content');
      expect(row!.summary).toBe('New summary');
    });

    it('preserves fields not included in Update (no NULL overwrite)', async () => {
      const objectUri = `https://${REMOTE_DOMAIN}/content/partial-update`;
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Original Title',
        content: '<p>Original content</p>',
        summary: 'Original summary',
        url: `https://${REMOTE_DOMAIN}/article/partial-update`,
        attributedTo: REMOTE_ALICE,
      });

      // Send Update with only content changed — title/summary/url should NOT be wiped
      await handlers.onUpdate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        content: '<p>Updated content only</p>',
      });

      const [row] = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, objectUri));
      expect(row!.title).toBe('Original Title'); // Must be preserved
      expect(row!.summary).toBe('Original summary'); // Must be preserved
      expect(row!.url).toBe(`https://${REMOTE_DOMAIN}/article/partial-update`); // Must be preserved
      expect(row!.content).toContain('Updated content only'); // Updated
    });

    it('sanitizes updated content', async () => {
      const objectUri = `https://${REMOTE_DOMAIN}/content/update-xss`;
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Safe',
        content: '<p>Safe</p>',
        attributedTo: REMOTE_ALICE,
      });

      await handlers.onUpdate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        content: '<p>Still safe</p><script>evil()</script>',
      });

      const [row] = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, objectUri));
      expect(row!.content).not.toContain('<script>');
    });
  });

  describe('inbound Delete', () => {
    it('soft-deletes federated content', async () => {
      const objectUri = `https://${REMOTE_DOMAIN}/content/delete-test`;
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'To Be Deleted',
        content: '<p>Bye</p>',
        attributedTo: REMOTE_ALICE,
      });

      // Verify it exists in timeline
      const before = await listFederatedTimeline(db);
      expect(before.items.find((i) => i.objectUri === objectUri)).toBeDefined();

      // Send Delete
      await handlers.onDelete(REMOTE_ALICE, objectUri);

      // Should not appear in timeline (deletedAt is set)
      const after = await listFederatedTimeline(db);
      expect(after.items.find((i) => i.objectUri === objectUri)).toBeUndefined();

      // Row still exists in DB (soft delete)
      const [row] = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, objectUri));
      expect(row).toBeDefined();
      expect(row!.deletedAt).not.toBeNull();
    });
  });

  describe('timeline queries', () => {
    it('returns items ordered by receivedAt descending', async () => {
      const { items } = await listFederatedTimeline(db, { limit: 100 });
      expect(items.length).toBeGreaterThan(1);

      // Each item should be received after the next
      for (let i = 0; i < items.length - 1; i++) {
        const a = new Date(items[i]!.receivedAt).getTime();
        const b = new Date(items[i + 1]!.receivedAt).getTime();
        expect(a).toBeGreaterThanOrEqual(b);
      }
    });

    it('paginates correctly', async () => {
      const page1 = await listFederatedTimeline(db, { limit: 2, offset: 0 });
      const page2 = await listFederatedTimeline(db, { limit: 2, offset: 2 });

      expect(page1.items.length).toBeLessThanOrEqual(2);
      expect(page1.total).toBeGreaterThan(0);

      // Pages should not overlap
      const page1Ids = new Set(page1.items.map((i) => i.id));
      for (const item of page2.items) {
        expect(page1Ids.has(item.id)).toBe(false);
      }
    });

    it('filters by apType', async () => {
      const { items } = await listFederatedTimeline(db, { apType: 'Note' });
      for (const item of items) {
        expect(item.apType).toBe('Note');
      }
    });

    it('filters by originDomain', async () => {
      const { items } = await listFederatedTimeline(db, { originDomain: REMOTE_DOMAIN });
      for (const item of items) {
        expect(item.originDomain).toBe(REMOTE_DOMAIN);
      }
    });

    it('excludes soft-deleted content', async () => {
      const { items } = await listFederatedTimeline(db, { limit: 100 });
      for (const item of items) {
        // getFederatedContent also excludes deleted
        const full = await getFederatedContent(db, item.id);
        expect(full).not.toBeNull();
      }
    });
  });

  describe('getFederatedContent', () => {
    it('returns full content item by ID', async () => {
      const { items } = await listFederatedTimeline(db, { limit: 1 });
      expect(items.length).toBe(1);

      const full = await getFederatedContent(db, items[0]!.id);
      expect(full).not.toBeNull();
      expect(full!.id).toBe(items[0]!.id);
      expect(full!.objectUri).toBe(items[0]!.objectUri);
    });

    it('returns null for non-existent ID', async () => {
      const result = await getFederatedContent(db, crypto.randomUUID());
      expect(result).toBeNull();
    });
  });

  describe('likeRemoteContent', () => {
    it('increments localLikeCount and creates outbound Like activity', async () => {
      const { items } = await listFederatedTimeline(db, { limit: 1 });
      const item = items[0]!;
      const beforeLikes = item.localLikeCount;
      const beforeActivities = (
        await listFederationActivity(db, { type: 'Like', direction: 'outbound' })
      ).total;

      const success = await likeRemoteContent(db, userId, item.id, DOMAIN);
      expect(success).toBe(true);

      // Verify like count incremented
      const updated = await getFederatedContent(db, item.id);
      expect(updated!.localLikeCount).toBe(beforeLikes + 1);

      // Verify outbound Like activity created
      const afterActivities = (
        await listFederationActivity(db, { type: 'Like', direction: 'outbound' })
      ).total;
      expect(afterActivities).toBe(beforeActivities + 1);
    });

    it('returns false for non-existent content', async () => {
      const result = await likeRemoteContent(db, userId, crypto.randomUUID(), DOMAIN);
      expect(result).toBe(false);
    });

    it('is idempotent — second like by same user does not inflate count', async () => {
      // Create fresh content for this test
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: `https://${REMOTE_DOMAIN}/content/dedup-like-test`,
        name: 'Dedup Like Test',
        content: '<p>Test</p>',
        attributedTo: REMOTE_ALICE,
      });

      const rows = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, `https://${REMOTE_DOMAIN}/content/dedup-like-test`));
      const contentId = rows[0]!.id;

      // First like
      const result1 = await likeRemoteContent(db, userId, contentId, DOMAIN);
      expect(result1).toBe(true);

      const after1 = await getFederatedContent(db, contentId);
      const count1 = after1!.localLikeCount;

      // Second like — should be idempotent (no count change)
      const result2 = await likeRemoteContent(db, userId, contentId, DOMAIN);
      expect(result2).toBe(true);

      const after2 = await getFederatedContent(db, contentId);
      expect(after2!.localLikeCount).toBe(count1); // Count must NOT increase
    });
  });

  describe('boostRemoteContent', () => {
    it('creates outbound Announce activity', async () => {
      const { items } = await listFederatedTimeline(db, { limit: 1 });
      const item = items[0]!;
      const beforeActivities = (
        await listFederationActivity(db, { type: 'Announce', direction: 'outbound' })
      ).total;

      const success = await boostRemoteContent(db, userId, item.id, DOMAIN);
      expect(success).toBe(true);

      const afterActivities = (
        await listFederationActivity(db, { type: 'Announce', direction: 'outbound' })
      ).total;
      expect(afterActivities).toBe(beforeActivities + 1);
    });

    it('returns false for non-existent content', async () => {
      const result = await boostRemoteContent(db, userId, crypto.randomUUID(), DOMAIN);
      expect(result).toBe(false);
    });
  });

  // --- Phase 4: Reply/Comment Federation ---

  describe('federateReply', () => {
    it('creates outbound Create(Note) with inReplyTo', async () => {
      const { items } = await listFederatedTimeline(db, { limit: 1 });
      const item = items[0]!;
      const beforeActivities = (
        await listFederationActivity(db, { type: 'Create', direction: 'outbound' })
      ).total;

      const success = await federateReply(db, userId, item.id, 'Great project!', DOMAIN);
      expect(success).toBe(true);

      const afterActivities = (
        await listFederationActivity(db, { type: 'Create', direction: 'outbound' })
      ).total;
      expect(afterActivities).toBe(beforeActivities + 1);

      // Verify payload has inReplyTo
      const log = await listFederationActivity(db, { type: 'Create', direction: 'outbound' });
      const replyActivity = log.items[0]!;
      const payload = replyActivity.payload as Record<string, unknown>;
      const object = payload.object as Record<string, unknown>;
      expect(object.type).toBe('Note');
      expect(object.inReplyTo).toBe(item.objectUri);
      expect(object.content).toBe('Great project!');
    });

    it('returns false for non-existent content', async () => {
      const result = await federateReply(db, userId, crypto.randomUUID(), 'Test', DOMAIN);
      expect(result).toBe(false);
    });
  });

  describe('inbound replies (Note with inReplyTo)', () => {
    it('stores reply and increments localCommentCount on parent federated content', async () => {
      // Create parent content
      const parentUri = `https://${REMOTE_DOMAIN}/content/parent-for-replies`;
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: parentUri,
        name: 'Parent Article',
        content: '<p>Parent</p>',
        attributedTo: REMOTE_ALICE,
      });

      const beforeRows = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, parentUri));
      const beforeComments = beforeRows[0]!.localCommentCount;

      // Send a reply (Note with inReplyTo pointing to parent)
      await handlers.onCreate(REMOTE_BOB, {
        type: 'Note',
        id: `https://${REMOTE_DOMAIN}/notes/reply-1`,
        content: '<p>Nice article!</p>',
        inReplyTo: parentUri,
        attributedTo: REMOTE_BOB,
      });

      // Reply should be stored
      const replies = await listRemoteReplies(db, parentUri);
      expect(replies.length).toBeGreaterThanOrEqual(1);
      const reply = replies.find((r) => r.objectUri.includes('reply-1'));
      expect(reply).toBeDefined();
      expect(reply!.content).toContain('Nice article');
      expect(reply!.inReplyTo).toBe(parentUri);
      expect(reply!.actor!.preferredUsername).toBe('bob');

      // Parent's localCommentCount should be incremented
      const afterRows = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, parentUri));
      expect(afterRows[0]!.localCommentCount).toBe(beforeComments + 1);
    });

    it('increments commentCount on local content when reply targets it', async () => {
      // Create local content first
      const { createContent, publishContent } = await import('../content/content.js');
      const localContent = await createContent(db, userId, {
        type: 'article',
        title: 'Local Article For Replies',
      });
      await publishContent(db, localContent.id, userId);

      const localSlug = localContent.slug;
      const localUri = `https://${DOMAIN}/content/${localSlug}`;

      // Get current comment count
      const { contentItems: ci } = await import('@commonpub/schema');
      const [before] = await db
        .select({ commentCount: ci.commentCount })
        .from(ci)
        .where(eq(ci.id, localContent.id));
      const beforeCount = before!.commentCount;

      // Send a reply targeting local content
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Note',
        id: `https://${REMOTE_DOMAIN}/notes/reply-to-local`,
        content: '<p>Commenting on your article!</p>',
        inReplyTo: localUri,
        attributedTo: REMOTE_ALICE,
      });

      // Local content's commentCount should be incremented
      const [after] = await db
        .select({ commentCount: ci.commentCount })
        .from(ci)
        .where(eq(ci.id, localContent.id));
      expect(after!.commentCount).toBe(beforeCount + 1);
    });

    it('does not increment counts when inReplyTo is from local domain (loop guard)', async () => {
      // A Note with inReplyTo pointing to our own domain should still be rejected
      // by the loop prevention (objectUri check on the Note itself, not the parent)
      const localNoteUri = `https://${DOMAIN}/notes/local-note`;
      const beforeTimeline = (await listFederatedTimeline(db, { limit: 200 })).total;

      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Note',
        id: localNoteUri,
        content: '<p>Echoed back</p>',
        inReplyTo: `https://${REMOTE_DOMAIN}/content/something`,
        attributedTo: REMOTE_ALICE,
      });

      // The Note's own objectUri is local → rejected by loop prevention
      const afterTimeline = (await listFederatedTimeline(db, { limit: 200 })).total;
      expect(afterTimeline).toBe(beforeTimeline);
    });
  });

  describe('listRemoteReplies', () => {
    it('returns empty array for content with no replies', async () => {
      const replies = await listRemoteReplies(db, 'https://nonexistent.example.com/content/no-replies');
      expect(replies).toHaveLength(0);
    });

    it('excludes soft-deleted replies', async () => {
      const parentUri = `https://${REMOTE_DOMAIN}/content/parent-delete-replies`;
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: parentUri,
        name: 'Parent',
        content: '<p>P</p>',
        attributedTo: REMOTE_ALICE,
      });

      const replyUri = `https://${REMOTE_DOMAIN}/notes/reply-to-delete`;
      await handlers.onCreate(REMOTE_BOB, {
        type: 'Note',
        id: replyUri,
        content: '<p>Reply</p>',
        inReplyTo: parentUri,
        attributedTo: REMOTE_BOB,
      });

      // Reply should be visible
      const before = await listRemoteReplies(db, parentUri);
      expect(before.find((r) => r.objectUri === replyUri)).toBeDefined();

      // Delete the reply
      await handlers.onDelete(REMOTE_BOB, replyUri);

      // Reply should be hidden
      const after = await listRemoteReplies(db, parentUri);
      expect(after.find((r) => r.objectUri === replyUri)).toBeUndefined();
    });
  });
});
