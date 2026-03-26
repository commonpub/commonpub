/**
 * Federation hook integration tests.
 * Tests the onContentPublished/Updated/Deleted hooks that bridge
 * content mutations to federation activity creation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createContent,
  publishContent,
  onContentPublished,
  onContentUpdated,
  onContentDeleted,
} from '../content/content.js';
import {
  listFederationActivity,
  federateDelete,
  federateUnlike,
  federateLike,
  buildContentUri,
  getContentSlugById,
} from '../federation/federation.js';
import { createInboxHandlers } from '../federation/inboxHandlers.js';
import { onContentLiked, onContentUnliked } from '../social/social.js';
import { remoteActors } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';

const DOMAIN = 'test.example.com';

function createTestConfig(overrides?: {
  features?: Partial<CommonPubConfig['features']>;
  instance?: Partial<CommonPubConfig['instance']>;
}): CommonPubConfig {
  return {
    instance: {
      domain: DOMAIN,
      name: 'Test Instance',
      description: 'A test CommonPub instance',
      contactEmail: 'admin@test.example.com',
      maxUploadSize: 10 * 1024 * 1024,
      contentTypes: ['project', 'article', 'blog', 'explainer'],
      ...overrides?.instance,
    },
    features: {
      content: true,
      social: true,
      hubs: true,
      docs: true,
      video: true,
      contests: false,
      learning: true,
      explainers: true,
      federation: false,
      admin: false,
      ...overrides?.features,
    },
    auth: {
      emailPassword: true,
      magicLink: false,
      passkeys: false,
    },
  };
}

describe('federation hooks integration', () => {
  let db: DB;
  let userId: string;
  let username: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'hookuser' });
    userId = user.id;
    username = user.username;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('onContentPublished', () => {
    it('creates Create activity when federation is enabled', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      const content = await createContent(db, userId, {
        type: 'article',
        title: 'Federated Article',
        description: 'Testing hooks',
      });
      await publishContent(db, content.id, userId);

      const beforeCount = (await listFederationActivity(db, { type: 'Create' })).total;

      await onContentPublished(db, content.id, config);

      const afterCount = (await listFederationActivity(db, { type: 'Create' })).total;
      expect(afterCount).toBe(beforeCount + 1);

      // Verify the activity payload
      const log = await listFederationActivity(db, { type: 'Create', direction: 'outbound' });
      const activity = log.items.find((a) =>
        a.objectUri?.includes('federated-article'),
      );
      expect(activity).toBeDefined();
      expect(activity!.status).toBe('pending');
    });

    it('is no-op when federation is disabled', async () => {
      const config = createTestConfig({
        features: { federation: false },
        instance: { domain: DOMAIN },
      });

      const content = await createContent(db, userId, {
        type: 'article',
        title: 'Local Only Article',
      });
      await publishContent(db, content.id, userId);

      const beforeCount = (await listFederationActivity(db, { type: 'Create' })).total;

      await onContentPublished(db, content.id, config);

      const afterCount = (await listFederationActivity(db, { type: 'Create' })).total;
      expect(afterCount).toBe(beforeCount);
    });

    it('does not throw on federation error (catches silently)', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      // Use a non-existent content ID — the hook should catch the error
      await expect(
        onContentPublished(db, crypto.randomUUID(), config),
      ).resolves.toBeUndefined();
    });

    it('does not federate draft content even when federation is enabled', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      // Create content but do NOT publish it (stays as draft)
      const content = await createContent(db, userId, {
        type: 'article',
        title: 'Draft Should Not Federate',
      });

      const beforeCount = (await listFederationActivity(db, { type: 'Create' })).total;

      // Call the hook directly on a draft — the guard in federateContent should stop it
      await onContentPublished(db, content.id, config);

      const afterCount = (await listFederationActivity(db, { type: 'Create' })).total;
      expect(afterCount).toBe(beforeCount);
    });

    it('does not federate updates to draft content', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      const content = await createContent(db, userId, {
        type: 'blog',
        title: 'Draft Update Should Not Federate',
      });

      const beforeCount = (await listFederationActivity(db, { type: 'Update' })).total;

      await onContentUpdated(db, content.id, config);

      const afterCount = (await listFederationActivity(db, { type: 'Update' })).total;
      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('onContentUpdated', () => {
    it('creates Update activity when federation is enabled', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      const content = await createContent(db, userId, {
        type: 'blog',
        title: 'Updated Blog Post',
      });
      await publishContent(db, content.id, userId);

      const beforeCount = (await listFederationActivity(db, { type: 'Update' })).total;

      await onContentUpdated(db, content.id, config);

      const afterCount = (await listFederationActivity(db, { type: 'Update' })).total;
      expect(afterCount).toBe(beforeCount + 1);
    });

    it('is no-op when federation is disabled', async () => {
      const config = createTestConfig({
        features: { federation: false },
      });

      const content = await createContent(db, userId, {
        type: 'blog',
        title: 'Local Blog',
      });

      const beforeCount = (await listFederationActivity(db, { type: 'Update' })).total;

      await onContentUpdated(db, content.id, config);

      const afterCount = (await listFederationActivity(db, { type: 'Update' })).total;
      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('onContentDeleted', () => {
    it('creates Delete activity when federation is enabled', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      const content = await createContent(db, userId, {
        type: 'article',
        title: 'To Be Deleted',
      });
      await publishContent(db, content.id, userId);

      const beforeCount = (await listFederationActivity(db, { type: 'Delete' })).total;

      await onContentDeleted(db, content.id, username, config);

      const afterCount = (await listFederationActivity(db, { type: 'Delete' })).total;
      expect(afterCount).toBe(beforeCount + 1);

      // Verify the Delete activity contains a Tombstone
      const log = await listFederationActivity(db, { type: 'Delete', direction: 'outbound' });
      const activity = log.items[0]!;
      const payload = activity.payload as Record<string, unknown>;
      expect(payload.type).toBe('Delete');
      const object = payload.object as Record<string, unknown>;
      expect(object.type).toBe('Tombstone');
    });

    it('is no-op when federation is disabled', async () => {
      const config = createTestConfig({
        features: { federation: false },
      });

      const beforeCount = (await listFederationActivity(db, { type: 'Delete' })).total;

      await onContentDeleted(db, crypto.randomUUID(), username, config);

      const afterCount = (await listFederationActivity(db, { type: 'Delete' })).total;
      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('activity payload structure', () => {
    it('Create activity has valid AP Article in payload', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      const content = await createContent(db, userId, {
        type: 'project',
        title: 'Payload Structure Test',
        description: 'Verifying AP structure',
      });
      await publishContent(db, content.id, userId);
      await onContentPublished(db, content.id, config);

      const log = await listFederationActivity(db, { type: 'Create' });
      const latest = log.items[0]!;
      const payload = latest.payload as Record<string, unknown>;

      // Activity-level fields
      expect(payload['@context']).toBe('https://www.w3.org/ns/activitystreams');
      expect(payload.type).toBe('Create');
      expect(payload.actor).toBe(`https://${DOMAIN}/users/${username}`);
      expect(typeof payload.id).toBe('string');
      expect((payload.id as string).startsWith(`https://${DOMAIN}/activities/`)).toBe(true);

      // Object-level fields
      const object = payload.object as Record<string, unknown>;
      expect(object.type).toBe('Article');
      expect(object.name).toBe('Payload Structure Test');
      expect(object.attributedTo).toBe(`https://${DOMAIN}/users/${username}`);
      expect(object.to).toEqual(['https://www.w3.org/ns/activitystreams#Public']);
      expect(object.cc).toEqual([`https://${DOMAIN}/users/${username}/followers`]);
      expect(typeof object.id).toBe('string');
      expect(typeof object.url).toBe('string');
    });

    it('Delete activity uses slug-based URI matching the original Create', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      const content = await createContent(db, userId, {
        type: 'article',
        title: 'Delete URI Test',
      });
      await publishContent(db, content.id, userId);

      // Publish first so we know the slug-based URI
      await onContentPublished(db, content.id, config);
      const createLog = await listFederationActivity(db, { type: 'Create', direction: 'outbound' });
      const createPayload = createLog.items[0]!.payload as Record<string, unknown>;
      const createObject = createPayload.object as Record<string, unknown>;
      const originalObjectUri = createObject.id as string;

      // Now delete
      await onContentDeleted(db, content.id, username, config);
      const deleteLog = await listFederationActivity(db, { type: 'Delete', direction: 'outbound' });
      const deletePayload = deleteLog.items[0]!.payload as Record<string, unknown>;
      const deleteObject = deletePayload.object as Record<string, unknown>;

      // The Delete Tombstone's formerType id should use the same URI scheme as Create
      expect(deleteObject.type).toBe('Tombstone');
      // Both should use slug-based URIs
      expect(deleteLog.items[0]!.objectUri).toContain('delete-uri-test');
      expect(originalObjectUri).toContain('delete-uri-test');
      // URIs should match
      expect(deleteLog.items[0]!.objectUri).toBe(originalObjectUri);
    });

    it('Like activity has correct AP structure', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      const content = await createContent(db, userId, {
        type: 'project',
        title: 'Like Payload Test',
      });
      await publishContent(db, content.id, userId);
      const contentUri = buildContentUri(DOMAIN, content.slug);

      await onContentLiked(db, userId, contentUri, config);

      const log = await listFederationActivity(db, { type: 'Like', direction: 'outbound' });
      expect(log.total).toBeGreaterThanOrEqual(1);

      const activity = log.items[0]!;
      const payload = activity.payload as Record<string, unknown>;
      expect(payload.type).toBe('Like');
      expect(payload.actor).toBe(`https://${DOMAIN}/users/${username}`);
      expect(payload.object).toBe(contentUri);
      expect(activity.objectUri).toBe(contentUri);
      expect(activity.status).toBe('pending');
    });

    it('Undo(Like) activity has correct AP structure', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      const content = await createContent(db, userId, {
        type: 'blog',
        title: 'Unlike Payload Test',
      });
      await publishContent(db, content.id, userId);
      const contentUri = buildContentUri(DOMAIN, content.slug);

      await onContentUnliked(db, userId, contentUri, config);

      const log = await listFederationActivity(db, { type: 'Undo', direction: 'outbound' });
      expect(log.total).toBeGreaterThanOrEqual(1);

      const activity = log.items[0]!;
      const payload = activity.payload as Record<string, unknown>;
      expect(payload.type).toBe('Undo');
      expect(payload.actor).toBe(`https://${DOMAIN}/users/${username}`);
      expect(activity.objectUri).toBe(contentUri);
      expect(activity.status).toBe('pending');
    });
  });

  describe('onContentLiked', () => {
    it('creates Like activity when federation is enabled', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      const content = await createContent(db, userId, {
        type: 'project',
        title: 'Like Hook Test',
      });
      await publishContent(db, content.id, userId);
      const contentUri = buildContentUri(DOMAIN, content.slug);

      const beforeCount = (await listFederationActivity(db, { type: 'Like' })).total;

      await onContentLiked(db, userId, contentUri, config);

      const afterCount = (await listFederationActivity(db, { type: 'Like' })).total;
      expect(afterCount).toBe(beforeCount + 1);
    });

    it('is no-op when federation is disabled', async () => {
      const config = createTestConfig({
        features: { federation: false },
      });

      const beforeCount = (await listFederationActivity(db, { type: 'Like' })).total;

      await onContentLiked(db, userId, `https://${DOMAIN}/content/whatever`, config);

      const afterCount = (await listFederationActivity(db, { type: 'Like' })).total;
      expect(afterCount).toBe(beforeCount);
    });

    it('does not throw for non-existent user (catches silently)', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      // federateLike looks up user by ID — non-existent ID should not throw
      await expect(
        onContentLiked(db, crypto.randomUUID(), `https://${DOMAIN}/content/test`, config),
      ).resolves.toBeUndefined();
    });
  });

  describe('onContentUnliked', () => {
    it('creates Undo activity when federation is enabled', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      const content = await createContent(db, userId, {
        type: 'article',
        title: 'Unlike Hook Test',
      });
      await publishContent(db, content.id, userId);
      const contentUri = buildContentUri(DOMAIN, content.slug);

      const beforeCount = (await listFederationActivity(db, { type: 'Undo' })).total;

      await onContentUnliked(db, userId, contentUri, config);

      const afterCount = (await listFederationActivity(db, { type: 'Undo' })).total;
      expect(afterCount).toBe(beforeCount + 1);
    });

    it('is no-op when federation is disabled', async () => {
      const config = createTestConfig({
        features: { federation: false },
      });

      const beforeCount = (await listFederationActivity(db, { type: 'Undo' })).total;

      await onContentUnliked(db, userId, `https://${DOMAIN}/content/whatever`, config);

      const afterCount = (await listFederationActivity(db, { type: 'Undo' })).total;
      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('buildContentUri', () => {
    it('constructs correct slug-based URI', () => {
      expect(buildContentUri('example.com', 'my-project')).toBe(
        'https://example.com/content/my-project',
      );
    });

    it('handles special characters in slug', () => {
      expect(buildContentUri('example.com', 'hello-world-2024')).toBe(
        'https://example.com/content/hello-world-2024',
      );
    });
  });

  describe('getContentSlugById', () => {
    it('returns slug for existing content', async () => {
      const content = await createContent(db, userId, {
        type: 'blog',
        title: 'Slug Lookup Test',
      });

      const slug = await getContentSlugById(db, content.id);
      expect(slug).toBe(content.slug);
    });

    it('returns null for non-existent content', async () => {
      const slug = await getContentSlugById(db, crypto.randomUUID());
      expect(slug).toBeNull();
    });
  });

  describe('federateDelete slug fix', () => {
    it('uses slug-based URI even after soft delete', async () => {
      const config = createTestConfig({
        features: { federation: true },
        instance: { domain: DOMAIN },
      });

      const content = await createContent(db, userId, {
        type: 'article',
        title: 'Soft Delete Slug Test',
      });
      await publishContent(db, content.id, userId);

      // Simulate soft delete (set deletedAt) — content row still exists
      const { contentItems } = await import('@commonpub/schema');
      const { eq } = await import('drizzle-orm');
      await db
        .update(contentItems)
        .set({ deletedAt: new Date(), status: 'archived' })
        .where(eq(contentItems.id, content.id));

      // federateDelete should still find the slug
      await federateDelete(db, content.id, DOMAIN, username);

      const log = await listFederationActivity(db, { type: 'Delete', direction: 'outbound' });
      const latest = log.items[0]!;
      // Should use slug, not UUID
      expect(latest.objectUri).toContain(content.slug);
      expect(latest.objectUri).not.toContain(content.id);
    });
  });

  describe('loop prevention', () => {
    const REMOTE_ALICE = 'https://remote.example.com/users/alice';
    const REMOTE_BOB = 'https://remote.example.com/users/bob';

    // Pre-populate remote actors so resolveRemoteActor hits cache (no real HTTP needed)
    beforeAll(async () => {
      for (const [uri, name] of [[REMOTE_ALICE, 'alice'], [REMOTE_BOB, 'bob']] as const) {
        await db.insert(remoteActors).values({
          actorUri: uri,
          inbox: `https://remote.example.com/users/${name}/inbox`,
          instanceDomain: 'remote.example.com',
          preferredUsername: name,
        }).onConflictDoNothing();
      }
    });

    it('inbound Create does NOT generate outbound Create (no re-federation)', async () => {
      const handlers = createInboxHandlers({
        db,
        domain: DOMAIN,
        autoAcceptFollows: true,
      });

      const beforeOutbound = (
        await listFederationActivity(db, { type: 'Create', direction: 'outbound' })
      ).total;

      // Simulate receiving an inbound Create(Article) from a remote instance
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: 'https://remote.example.com/content/test-article',
        name: 'Remote Article',
        content: '<p>This should NOT be re-federated</p>',
        attributedTo: 'https://remote.example.com/users/alice',
      });

      const afterOutbound = (
        await listFederationActivity(db, { type: 'Create', direction: 'outbound' })
      ).total;

      // Inbound Create must NOT generate any outbound Create
      expect(afterOutbound).toBe(beforeOutbound);

      // Verify the inbound activity was logged as inbound
      const inboundLog = await listFederationActivity(db, {
        type: 'Create',
        direction: 'inbound',
      });
      expect(inboundLog.total).toBeGreaterThanOrEqual(1);
      const latest = inboundLog.items[0]!;
      expect(latest.direction).toBe('inbound');
      expect(latest.status).toBe('processed');
    });

    it('inbound Like does NOT generate outbound Like (no echo)', async () => {
      const handlers = createInboxHandlers({
        db,
        domain: DOMAIN,
        autoAcceptFollows: true,
      });

      const beforeOutbound = (
        await listFederationActivity(db, { type: 'Like', direction: 'outbound' })
      ).total;

      // Simulate receiving an inbound Like from a remote instance
      // Use a valid UUID in the URI path since onLike extracts it and queries by ID
      await handlers.onLike(
        REMOTE_BOB,
        `https://${DOMAIN}/content/${crypto.randomUUID()}`,
      );

      const afterOutbound = (
        await listFederationActivity(db, { type: 'Like', direction: 'outbound' })
      ).total;

      // Inbound Like must NOT generate any outbound Like
      expect(afterOutbound).toBe(beforeOutbound);
    });
  });
});
