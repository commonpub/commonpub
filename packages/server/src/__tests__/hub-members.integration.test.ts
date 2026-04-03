/**
 * Integration tests for federated hub members (federatedHubMembers table).
 *
 * Tests:
 * - upsertFederatedHubMember (direct insert, dedup, discoveredVia)
 * - listFederatedHubMembers (post authors + followers + mixed)
 * - ingestFederatedHubPost auto-registers author as member
 * - sharedContentMeta type field presence for content type filtering
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  federatedHubs,
  federatedHubPosts,
  federatedHubMembers,
  remoteActors,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  followRemoteHub,
  acceptHubFollow,
  ingestFederatedHubPost,
  listFederatedHubMembers,
  upsertFederatedHubMember,
} from '../federation/hubMirroring.js';

const DOMAIN = 'remote.example.com';
const HUB_ACTOR = `https://${DOMAIN}/hubs/makers`;

describe('federated hub members', () => {
  let db: DB;
  let userId: string;
  let hubId: string;
  let aliceActorId: string;
  let bobActorId: string;
  let charlieActorId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'localuser' });
    userId = user.id;

    // Create remote actors
    const [hubActor] = await db.insert(remoteActors).values({
      actorUri: HUB_ACTOR,
      inbox: `${HUB_ACTOR}/inbox`,
      actorType: 'Group',
      instanceDomain: DOMAIN,
      preferredUsername: 'makers',
      displayName: 'Makers Hub',
    }).returning();

    const [alice] = await db.insert(remoteActors).values({
      actorUri: `https://${DOMAIN}/users/alice`,
      inbox: `https://${DOMAIN}/users/alice/inbox`,
      instanceDomain: DOMAIN,
      preferredUsername: 'alice',
      displayName: 'Alice Builder',
      avatarUrl: 'https://remote.example.com/avatars/alice.png',
    }).returning();
    aliceActorId = alice!.id;

    const [bob] = await db.insert(remoteActors).values({
      actorUri: `https://${DOMAIN}/users/bob`,
      inbox: `https://${DOMAIN}/users/bob/inbox`,
      instanceDomain: DOMAIN,
      preferredUsername: 'bob',
      displayName: 'Bob Lurker',
    }).returning();
    bobActorId = bob!.id;

    const [charlie] = await db.insert(remoteActors).values({
      actorUri: `https://${DOMAIN}/users/charlie`,
      inbox: `https://${DOMAIN}/users/charlie/inbox`,
      instanceDomain: DOMAIN,
      preferredUsername: 'charlie',
      displayName: 'Charlie Coder',
    }).returning();
    charlieActorId = charlie!.id;

    // Create and accept federated hub
    const result = await followRemoteHub(db, HUB_ACTOR, {
      originDomain: DOMAIN,
      remoteSlug: 'makers',
      name: 'Makers Hub',
      hubType: 'community',
      remoteMemberCount: 50,
    });
    hubId = result.id;
    await acceptHubFollow(db, HUB_ACTOR);
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // --- upsertFederatedHubMember ---

  describe('upsertFederatedHubMember', () => {
    it('inserts a new member with discoveredVia = followers', async () => {
      await upsertFederatedHubMember(db, hubId, bobActorId, 'followers');

      const [row] = await db
        .select()
        .from(federatedHubMembers)
        .where(eq(federatedHubMembers.remoteActorId, bobActorId));
      expect(row).toBeDefined();
      expect(row!.federatedHubId).toBe(hubId);
      expect(row!.discoveredVia).toBe('followers');
    });

    it('does not duplicate on second upsert (idempotent)', async () => {
      await upsertFederatedHubMember(db, hubId, bobActorId, 'post');

      const rows = await db
        .select()
        .from(federatedHubMembers)
        .where(eq(federatedHubMembers.remoteActorId, bobActorId));
      expect(rows.length).toBe(1);
      // discoveredVia should remain 'followers' (first insert wins)
      expect(rows[0]!.discoveredVia).toBe('followers');
    });

    it('can insert multiple distinct members', async () => {
      await upsertFederatedHubMember(db, hubId, charlieActorId, 'followers');

      const rows = await db
        .select()
        .from(federatedHubMembers)
        .where(eq(federatedHubMembers.federatedHubId, hubId));
      expect(rows.length).toBe(2); // bob + charlie
    });
  });

  // --- listFederatedHubMembers with followers-only members ---

  describe('listFederatedHubMembers - followers only', () => {
    it('returns members who have NOT posted with postCount=0', async () => {
      const members = await listFederatedHubMembers(db, hubId);
      expect(members.length).toBe(2);

      const bob = members.find(m => m.preferredUsername === 'bob');
      expect(bob).toBeDefined();
      expect(bob!.postCount).toBe(0);
      expect(bob!.displayName).toBe('Bob Lurker');
      expect(bob!.instanceDomain).toBe(DOMAIN);
    });
  });

  // --- ingestFederatedHubPost auto-registers author ---

  describe('ingestFederatedHubPost auto-registers member', () => {
    it('adds post author to members table on new post', async () => {
      await ingestFederatedHubPost(db, hubId, {
        objectUri: `${HUB_ACTOR}/posts/001`,
        actorUri: `https://${DOMAIN}/users/alice`,
        content: 'My first project build!',
        postType: 'showcase',
      });

      // Alice should now be in the members table
      const [member] = await db
        .select()
        .from(federatedHubMembers)
        .where(eq(federatedHubMembers.remoteActorId, aliceActorId));
      expect(member).toBeDefined();
      expect(member!.discoveredVia).toBe('post');
    });

    it('does not duplicate member on second post from same author', async () => {
      await ingestFederatedHubPost(db, hubId, {
        objectUri: `${HUB_ACTOR}/posts/002`,
        actorUri: `https://${DOMAIN}/users/alice`,
        content: 'Another showcase!',
        postType: 'showcase',
      });

      const rows = await db
        .select()
        .from(federatedHubMembers)
        .where(eq(federatedHubMembers.remoteActorId, aliceActorId));
      expect(rows.length).toBe(1);
    });
  });

  // --- listFederatedHubMembers with mixed sources ---

  describe('listFederatedHubMembers - mixed post authors and followers', () => {
    it('returns all members with correct post counts', async () => {
      const members = await listFederatedHubMembers(db, hubId);
      // bob (followers, 0 posts), charlie (followers, 0 posts), alice (post, 2 posts)
      expect(members.length).toBe(3);

      const alice = members.find(m => m.preferredUsername === 'alice');
      expect(alice).toBeDefined();
      expect(alice!.postCount).toBe(2);
      expect(alice!.avatarUrl).toBe('https://remote.example.com/avatars/alice.png');

      const bob = members.find(m => m.preferredUsername === 'bob');
      expect(bob).toBeDefined();
      expect(bob!.postCount).toBe(0);

      const charlie = members.find(m => m.preferredUsername === 'charlie');
      expect(charlie).toBeDefined();
      expect(charlie!.postCount).toBe(0);
    });

    it('orders by post count descending', async () => {
      const members = await listFederatedHubMembers(db, hubId);
      // alice (2 posts) should be first
      expect(members[0]!.preferredUsername).toBe('alice');
    });
  });

  // --- Empty hub ---

  describe('empty hub members', () => {
    it('returns empty array for hub with no members', async () => {
      const [emptyHub] = await db.insert(federatedHubs).values({
        actorUri: `https://${DOMAIN}/hubs/empty`,
        originDomain: DOMAIN,
        remoteSlug: 'empty',
        name: 'Empty Hub',
        hubType: 'community',
        status: 'accepted',
      }).returning();

      const members = await listFederatedHubMembers(db, emptyHub!.id);
      expect(members.length).toBe(0);
    });
  });

  // --- Fallback: posts exist but no member rows (backward compat) ---

  describe('fallback to post authors when members table empty', () => {
    it('returns post authors from posts table when no member rows exist', async () => {
      // Create a hub with posts but NO member entries (simulates pre-migration data)
      const [legacyHub] = await db.insert(federatedHubs).values({
        actorUri: `https://${DOMAIN}/hubs/legacy`,
        originDomain: DOMAIN,
        remoteSlug: 'legacy',
        name: 'Legacy Hub',
        hubType: 'community',
        status: 'accepted',
      }).returning();

      // Insert posts directly (bypassing ingestFederatedHubPost which auto-adds members)
      await db.insert(federatedHubPosts).values([
        {
          federatedHubId: legacyHub!.id,
          objectUri: `https://${DOMAIN}/hubs/legacy/posts/1`,
          actorUri: `https://${DOMAIN}/users/alice`,
          remoteActorId: aliceActorId,
          content: 'Legacy post 1',
          postType: 'text',
        },
        {
          federatedHubId: legacyHub!.id,
          objectUri: `https://${DOMAIN}/hubs/legacy/posts/2`,
          actorUri: `https://${DOMAIN}/users/alice`,
          remoteActorId: aliceActorId,
          content: 'Legacy post 2',
          postType: 'text',
        },
      ]);

      // No member rows exist for this hub — should fallback to post authors
      const members = await listFederatedHubMembers(db, legacyHub!.id);
      expect(members.length).toBe(1);
      expect(members[0]!.preferredUsername).toBe('alice');
      expect(members[0]!.postCount).toBe(2);
    });
  });

  // --- sharedContentMeta type field ---

  describe('sharedContentMeta type filtering', () => {
    it('preserves type in sharedContentMeta for project shares', async () => {
      await ingestFederatedHubPost(db, hubId, {
        objectUri: `${HUB_ACTOR}/posts/003`,
        actorUri: `https://${DOMAIN}/users/alice`,
        content: 'Check out this project!',
        postType: 'share',
        sharedContentMeta: {
          type: 'project',
          title: 'LED Matrix Build',
          summary: 'A cool LED project',
          coverImageUrl: 'https://remote.example.com/img/led.jpg',
          originUrl: 'https://remote.example.com/project/led-matrix',
        },
      });

      const [post] = await db
        .select()
        .from(federatedHubPosts)
        .where(eq(federatedHubPosts.objectUri, `${HUB_ACTOR}/posts/003`));

      const meta = post!.sharedContentMeta as Record<string, unknown>;
      expect(meta).toBeDefined();
      expect(meta.type).toBe('project');
      expect(meta.title).toBe('LED Matrix Build');
    });

    it('preserves type in sharedContentMeta for article shares', async () => {
      await ingestFederatedHubPost(db, hubId, {
        objectUri: `${HUB_ACTOR}/posts/004`,
        actorUri: `https://${DOMAIN}/users/charlie`,
        content: 'Interesting read!',
        postType: 'share',
        sharedContentMeta: {
          type: 'article',
          title: 'Getting Started with RP2040',
          summary: null,
          coverImageUrl: null,
          originUrl: 'https://remote.example.com/article/rp2040-intro',
        },
      });

      const [post] = await db
        .select()
        .from(federatedHubPosts)
        .where(eq(federatedHubPosts.objectUri, `${HUB_ACTOR}/posts/004`));

      const meta = post!.sharedContentMeta as Record<string, unknown>;
      expect(meta.type).toBe('article');
    });

    it('allows filtering shared posts by type at application level', async () => {
      // Simulate the UI filter: p.sharedContent?.type === 'project'
      const allPosts = await db
        .select()
        .from(federatedHubPosts)
        .where(eq(federatedHubPosts.federatedHubId, hubId));

      const projectShares = allPosts.filter(p => {
        const meta = p.sharedContentMeta as Record<string, unknown> | null;
        return meta?.type === 'project';
      });

      const articleShares = allPosts.filter(p => {
        const meta = p.sharedContentMeta as Record<string, unknown> | null;
        return meta?.type === 'article';
      });

      expect(projectShares.length).toBe(1);
      expect(articleShares.length).toBe(1);
      expect(projectShares[0]!.objectUri).toContain('posts/003');
      expect(articleShares[0]!.objectUri).toContain('posts/004');
    });

    it('does not return non-shared posts when filtering for projects', async () => {
      const allPosts = await db
        .select()
        .from(federatedHubPosts)
        .where(eq(federatedHubPosts.federatedHubId, hubId));

      // Text/showcase posts have null sharedContentMeta — should NOT match project filter
      const projectShares = allPosts.filter(p => {
        const meta = p.sharedContentMeta as Record<string, unknown> | null;
        return meta?.type === 'project';
      });

      // Only post/003 is a project share; posts/001, 002 are showcases, 004 is article
      expect(projectShares.length).toBe(1);
    });
  });
});
