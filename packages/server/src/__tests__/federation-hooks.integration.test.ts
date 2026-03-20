/**
 * Federation hook integration tests.
 * Tests the onContentPublished/Updated/Deleted hooks that bridge
 * content mutations to federation activity creation.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser } from './helpers/testdb.js';
import {
  createContent,
  publishContent,
  updateContent,
  deleteContent,
  onContentPublished,
  onContentUpdated,
  onContentDeleted,
} from '../content/content.js';
import { listFederationActivity } from '../federation/federation.js';
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
  });
});
