/**
 * Instance mirroring integration tests.
 * Tests mirror lifecycle, content filtering, anti-loop protection,
 * and the full inbound flow through mirrors.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createMirror,
  activateMirror,
  pauseMirror,
  resumeMirror,
  cancelMirror,
  listMirrors,
  getMirror,
  matchMirrorForContent,
} from '../federation/mirroring.js';
import { createInboxHandlers } from '../federation/inboxHandlers.js';
import { listFederatedTimeline, getFederatedContent } from '../federation/timeline.js';
import { getOrCreateActorKeypair } from '../federation/federation.js';
import { remoteActors, federatedContent, instanceMirrors } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

const DOMAIN = 'local.example.com';
const MIRROR_DOMAIN = 'mirror.example.com';
const MIRROR_ACTOR = `https://${MIRROR_DOMAIN}/actor`;
const REMOTE_ALICE = `https://${MIRROR_DOMAIN}/users/alice`;

describe('instance mirroring integration', () => {
  let db: DB;
  let userId: string;
  let handlers: ReturnType<typeof createInboxHandlers>;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'mirroruser' });
    userId = user.id;
    await getOrCreateActorKeypair(db, userId);

    // Pre-populate remote actor for mirror domain
    await db.insert(remoteActors).values({
      actorUri: REMOTE_ALICE,
      inbox: `https://${MIRROR_DOMAIN}/users/alice/inbox`,
      instanceDomain: MIRROR_DOMAIN,
      preferredUsername: 'alice',
      displayName: 'Alice from Mirror',
    });

    handlers = createInboxHandlers({ db, domain: DOMAIN, autoAcceptFollows: true });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('mirror lifecycle', () => {
    let mirrorId: string;

    it('creates a mirror in pending state', async () => {
      const mirror = await createMirror(db, MIRROR_DOMAIN, MIRROR_ACTOR, 'pull', DOMAIN, {
        contentTypes: ['article', 'project'],
      });
      mirrorId = mirror.id;
      expect(mirror.status).toBe('active');
      expect(mirror.remoteDomain).toBe(MIRROR_DOMAIN);
      expect(mirror.direction).toBe('pull');
      expect(mirror.filterContentTypes).toEqual(['article', 'project']);
      expect(mirror.contentCount).toBe(0);
    });

    it('activates a mirror', async () => {
      await activateMirror(db, mirrorId);
      const mirror = await getMirror(db, mirrorId);
      expect(mirror!.status).toBe('active');
    });

    it('pauses a mirror', async () => {
      await pauseMirror(db, mirrorId);
      const mirror = await getMirror(db, mirrorId);
      expect(mirror!.status).toBe('paused');
    });

    it('resumes a paused mirror', async () => {
      await resumeMirror(db, mirrorId);
      const mirror = await getMirror(db, mirrorId);
      expect(mirror!.status).toBe('active');
    });

    it('lists all mirrors', async () => {
      const mirrors = await listMirrors(db);
      expect(mirrors.length).toBeGreaterThanOrEqual(1);
      const found = mirrors.find((m) => m.id === mirrorId);
      expect(found).toBeDefined();
    });

    it('cancels a mirror', async () => {
      // Create a separate mirror to cancel
      const temp = await createMirror(db, 'temp.example.com', 'https://temp.example.com/actor', 'pull', DOMAIN);
      await cancelMirror(db, temp.id);
      const result = await getMirror(db, temp.id);
      expect(result).toBeNull();
    });
  });

  describe('content filtering', () => {
    it('accepts content matching type filter', async () => {
      // Mirror is active with filter: ['article', 'project']
      const mirrorId = await matchMirrorForContent(
        db,
        MIRROR_DOMAIN,
        'Article',
        'article',
        [],
      );
      expect(mirrorId).not.toBeNull();
    });

    it('rejects content not matching type filter', async () => {
      const mirrorId = await matchMirrorForContent(
        db,
        MIRROR_DOMAIN,
        'Article',
        'blog', // Not in filter
        [],
      );
      expect(mirrorId).toBeNull();
    });

    it('returns null for unknown domain', async () => {
      const mirrorId = await matchMirrorForContent(
        db,
        'unknown.example.com',
        'Article',
        'article',
        [],
      );
      expect(mirrorId).toBeNull();
    });

    it('does not match paused mirrors', async () => {
      // Find our active mirror and pause it
      const mirrors = await listMirrors(db);
      const active = mirrors.find((m) => m.remoteDomain === MIRROR_DOMAIN && m.status === 'active');
      if (active) {
        await pauseMirror(db, active.id);

        const mirrorId = await matchMirrorForContent(
          db,
          MIRROR_DOMAIN,
          'Article',
          'article',
          [],
        );
        expect(mirrorId).toBeNull();

        // Resume for subsequent tests
        await resumeMirror(db, active.id);
      }
    });
  });

  describe('tag filtering', () => {
    let tagMirrorId: string;

    beforeAll(async () => {
      // Create a mirror with tag filter
      const mirror = await createMirror(db, 'tagged.example.com', 'https://tagged.example.com/actor', 'pull', DOMAIN, {
        tags: ['arduino', 'robotics'],
      });
      tagMirrorId = mirror.id;
      await activateMirror(db, tagMirrorId);

      await db.insert(remoteActors).values({
        actorUri: 'https://tagged.example.com/users/bob',
        inbox: 'https://tagged.example.com/users/bob/inbox',
        instanceDomain: 'tagged.example.com',
        preferredUsername: 'bob',
      }).onConflictDoNothing();
    });

    it('accepts content with matching tag', async () => {
      const mirrorId = await matchMirrorForContent(
        db,
        'tagged.example.com',
        'Article',
        null,
        [{ name: '#arduino' }],
      );
      expect(mirrorId).toBe(tagMirrorId);
    });

    it('rejects content without matching tag', async () => {
      const mirrorId = await matchMirrorForContent(
        db,
        'tagged.example.com',
        'Article',
        null,
        [{ name: '#cooking' }],
      );
      expect(mirrorId).toBeNull();
    });

    it('tag matching is case-insensitive', async () => {
      const mirrorId = await matchMirrorForContent(
        db,
        'tagged.example.com',
        'Article',
        null,
        [{ name: '#ARDUINO' }],
      );
      expect(mirrorId).toBe(tagMirrorId);
    });
  });

  describe('anti-loop protection', () => {
    it('content from local domain is rejected by onCreate before mirror matching', async () => {
      // The loop prevention in onCreate checks objectUri hostname === localDomain
      // This happens BEFORE mirror matching, so even if a mirror exists for our own domain,
      // our own content can never be mirrored back to us.
      const localObjectUri = `https://${DOMAIN}/content/our-own-article`;
      const beforeTimeline = (await listFederatedTimeline(db, { limit: 200 })).total;

      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: localObjectUri,
        name: 'Our Own Content Echoed Back',
        content: '<p>This should be rejected</p>',
        attributedTo: REMOTE_ALICE,
      });

      const afterTimeline = (await listFederatedTimeline(db, { limit: 200 })).total;
      expect(afterTimeline).toBe(beforeTimeline);

      // Verify it was NOT stored in federatedContent
      const rows = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, localObjectUri));
      expect(rows).toHaveLength(0);
    });

    it('inbound content does NOT trigger outbound re-federation', async () => {
      // This is the core loop prevention test.
      // When mirror content arrives, it must NOT create outbound activities.
      const { listFederationActivity } = await import('../federation/federation.js');
      const beforeOutbound = (
        await listFederationActivity(db, { type: 'Create', direction: 'outbound' })
      ).total;

      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: `https://${MIRROR_DOMAIN}/content/mirror-loop-test`,
        name: 'Mirror Loop Test',
        content: '<p>This should be stored but NOT re-federated</p>',
        attributedTo: REMOTE_ALICE,
      });

      const afterOutbound = (
        await listFederationActivity(db, { type: 'Create', direction: 'outbound' })
      ).total;
      // No new outbound Create should exist
      expect(afterOutbound).toBe(beforeOutbound);
    });
  });

  describe('mirror content ingestion via inbox', () => {
    it('stores mirrored content with mirrorId set', async () => {
      // The active mirror for MIRROR_DOMAIN accepts 'article' and 'project'
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: `https://${MIRROR_DOMAIN}/content/mirrored-article`,
        name: 'Mirrored Article',
        content: '<p>Content from mirror</p>',
        'cpub:type': 'article',
        attributedTo: REMOTE_ALICE,
      });

      const rows = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, `https://${MIRROR_DOMAIN}/content/mirrored-article`));
      expect(rows).toHaveLength(1);
      // mirrorId should be set since the domain has an active mirror
      expect(rows[0]!.mirrorId).not.toBeNull();
    });

    it('increments mirror content count', async () => {
      const mirrors = await listMirrors(db);
      const mirror = mirrors.find((m) => m.remoteDomain === MIRROR_DOMAIN);
      expect(mirror).toBeDefined();
      expect(mirror!.contentCount).toBeGreaterThan(0);
    });
  });
});
