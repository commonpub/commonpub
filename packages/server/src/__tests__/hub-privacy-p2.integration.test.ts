/**
 * P-2 hub read-access enforcement (docs/plans/content-privacy-enforcement.md).
 *
 * Closes a LIVE unauthenticated leak: a `private` hub's posts / member roster /
 * gallery / resources / products were served with NO membership predicate. Hub
 * privacy (distinct from content visibility, P-1) gates on active membership:
 *
 *   a private hub is readable IFF the viewer is an active member (hubMembers
 *   status='active', reflected in getHubBySlug's currentUserRole) OR a platform
 *   admin. `public`/`unlisted` hubs serve by design.
 *
 * The enforcement is `getHubBySlug(db, slug, requesterId, { asPlatformAdmin })` +
 * `canReadHub`. As defense-in-depth the private-hub NON-MEMBER stub returns
 * REDACTED_HUB_ID, so every hubId-keyed read helper returns empty even without the
 * gate. A no-requesterId call keeps the real id, preserving the authenticated
 * WRITE/AP callers (join/leave/like/lock/pin) that resolve the hub by slug.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hubMembers, contentItems, hubShares } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createHub,
  getHubBySlug,
  getHubIdBySlug,
  updateHub,
  canReadHub,
  REDACTED_HUB_ID,
  createPost,
  listPosts,
  listMembers,
  createHubResource,
  listHubResources,
} from '../hub/index.js';
import { createProduct, listHubProducts, listHubGallery } from '../product/product.js';
import { createContent } from '../content/content.js';
import { createComment, listComments } from '../social/social.js';

describe('P-2 hub read-access enforcement', () => {
  let db: DB;
  let ownerId: string;
  let memberId: string;
  let strangerId: string;
  let adminId: string;

  let priv: { id: string; slug: string };
  let pubHub: { id: string; slug: string };
  let privPostId: string;

  beforeAll(async () => {
    db = await createTestDB();
    ownerId = (await createTestUser(db, { username: 'p2-owner' })).id;
    memberId = (await createTestUser(db, { username: 'p2-member' })).id;
    strangerId = (await createTestUser(db, { username: 'p2-stranger' })).id;
    adminId = (await createTestUser(db, { username: 'p2-admin', role: 'admin' })).id;

    const p = await createHub(db, ownerId, { name: 'P2 Secret Lab', privacy: 'private' });
    priv = { id: p.id, slug: p.slug };
    const pub = await createHub(db, ownerId, { name: 'P2 Open Plaza', privacy: 'public' });
    pubHub = { id: pub.id, slug: pub.slug };

    // Active member of the private hub.
    await db.insert(hubMembers).values({ hubId: priv.id, userId: memberId, role: 'member', status: 'active' });

    // Seed member-visible data in the private hub (created by the owner, a member).
    privPostId = (await createPost(db, ownerId, { hubId: priv.id, type: 'text', content: 'members-only bulletin' })).id;
    await createHubResource(db, priv.id, ownerId, { title: 'Wiki', url: 'https://example.com/wiki' });
    await createProduct(db, ownerId, priv.id, { name: 'Widget 3000' });

    // Seed gallery via a public published share.
    const shared = await createContent(db, ownerId, { type: 'project', title: 'P2 Shared Build', visibility: 'public' });
    await db.update(contentItems).set({ status: 'published', publishedAt: new Date() }).where(eq(contentItems.id, shared.id));
    await db.insert(hubShares).values({ hubId: priv.id, contentId: shared.id, sharedById: ownerId });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // Regression guard: the write path must resolve the REAL hub id (getHubIdBySlug, no
  // read-redaction) so a platform admin who is not a member can still edit/delete a
  // private hub. Using getHubBySlug(slug, requesterId) here returned REDACTED_HUB_ID and
  // broke admin edit/delete (500/403).
  describe('write helpers resolve the real id (admin edit of a private hub)', () => {
    it('getHubIdBySlug returns the real (non-redacted) id for a private hub', async () => {
      const hub = (await getHubIdBySlug(db, priv.slug))!;
      expect(hub.id).toBe(priv.id);
      expect(hub.id).not.toBe(REDACTED_HUB_ID);
    });
    it('a platform admin (non-member) can updateHub a private hub via the real id', async () => {
      const hub = (await getHubIdBySlug(db, priv.slug))!;
      const updated = await updateHub(db, hub.id, adminId, { description: 'edited by admin' }, { asPlatformAdmin: true });
      expect(updated).toBeTruthy();
      expect(updated!.description).toBe('edited by admin');
    });
    it('a non-member non-admin still cannot updateHub (auth enforced by updateHub)', async () => {
      const hub = (await getHubIdBySlug(db, priv.slug))!;
      const updated = await updateHub(db, hub.id, strangerId, { description: 'hax' }, { asPlatformAdmin: false });
      expect(updated).toBeFalsy();
    });
  });

  // Site 18: comments on a private-hub post are members-only (the generic /api/social/comments
  // endpoint never routes through a hub route, so listComments must gate it itself).
  describe('post-comment gating (private hub)', () => {
    it('hides a private-hub post thread from a non-member/anon, serves it to a member', async () => {
      await createComment(db, ownerId, { targetType: 'post', targetId: privPostId, content: 'secret note' });
      expect(await listComments(db, 'post', privPostId, undefined, undefined, strangerId)).toHaveLength(0);
      expect(await listComments(db, 'post', privPostId)).toHaveLength(0); // anon
      expect((await listComments(db, 'post', privPostId, undefined, undefined, memberId)).length).toBeGreaterThan(0);
    });
  });

  // ---- getHubBySlug membership resolution + non-member id redaction ----
  describe('getHubBySlug (private hub)', () => {
    it('redacts metadata AND the real id for an identified non-member', async () => {
      const hub = (await getHubBySlug(db, priv.slug, strangerId))!;
      expect(hub).not.toBeNull();
      expect(hub.id).toBe(REDACTED_HUB_ID);
      expect(hub.id).not.toBe(priv.id);
      expect(hub.currentUserRole).toBeNull();
      expect(hub.description).toBeNull();
    });

    it('serves the real id + role to an active member', async () => {
      const hub = (await getHubBySlug(db, priv.slug, memberId))!;
      expect(hub.id).toBe(priv.id);
      expect(hub.currentUserRole).toBe('member');
    });

    it('serves the real id + full detail to a platform admin (asPlatformAdmin)', async () => {
      const hub = (await getHubBySlug(db, priv.slug, adminId, { asPlatformAdmin: true }))!;
      expect(hub.id).toBe(priv.id);
      // full (un-redacted) detail even though admin is not a member
      expect(hub.privacy).toBe('private');
    });

    it('keeps the real id for a no-requesterId call (preserves write/AP callers)', async () => {
      const hub = (await getHubBySlug(db, priv.slug))!;
      expect(hub.id).toBe(priv.id);
      expect(hub.currentUserRole).toBeNull();
    });
  });

  // ---- canReadHub predicate ----
  describe('canReadHub', () => {
    it('denies a non-member/non-admin on a private hub', async () => {
      const hub = (await getHubBySlug(db, priv.slug, strangerId))!;
      expect(canReadHub(hub)).toBe(false);
      expect(canReadHub(hub, { asPlatformAdmin: false })).toBe(false);
    });
    it('grants an active member', async () => {
      const hub = (await getHubBySlug(db, priv.slug, memberId))!;
      expect(canReadHub(hub)).toBe(true);
    });
    it('grants a platform admin', async () => {
      const hub = (await getHubBySlug(db, priv.slug, strangerId))!;
      expect(canReadHub(hub, { asPlatformAdmin: true })).toBe(true);
    });
    it('grants everyone on a public hub', async () => {
      const hub = (await getHubBySlug(db, pubHub.slug, strangerId))!;
      expect(canReadHub(hub)).toBe(true);
    });
  });

  // ---- Data helpers, driven by the resolved hub id ----
  describe('private-hub data helpers via resolved id', () => {
    it('a non-member gets EMPTY posts/members/gallery/resources/products', async () => {
      const hub = (await getHubBySlug(db, priv.slug, strangerId))!; // → REDACTED_HUB_ID
      expect(canReadHub(hub)).toBe(false);
      expect((await listPosts(db, hub.id)).items).toHaveLength(0);
      expect((await listMembers(db, hub.id)).items).toHaveLength(0);
      expect((await listHubResources(db, hub.id)).items).toHaveLength(0);
      expect((await listHubProducts(db, hub.id)).items).toHaveLength(0);
      expect((await listHubGallery(db, hub.id)).items).toHaveLength(0);
    });

    it('an active member gets the real data', async () => {
      const hub = (await getHubBySlug(db, priv.slug, memberId))!;
      expect(canReadHub(hub)).toBe(true);
      expect((await listPosts(db, hub.id)).items.length).toBeGreaterThan(0);
      expect((await listMembers(db, hub.id)).items.length).toBe(2); // owner + member
      expect((await listHubResources(db, hub.id)).items.length).toBeGreaterThan(0);
      expect((await listHubProducts(db, hub.id)).items.length).toBeGreaterThan(0);
      expect((await listHubGallery(db, hub.id)).items.length).toBeGreaterThan(0);
    });

    it('a platform admin gets the real data', async () => {
      const hub = (await getHubBySlug(db, priv.slug, adminId, { asPlatformAdmin: true }))!;
      expect(canReadHub(hub, { asPlatformAdmin: true })).toBe(true);
      expect((await listPosts(db, hub.id)).items.length).toBeGreaterThan(0);
      expect((await listMembers(db, hub.id)).items.length).toBe(2);
      expect((await listHubProducts(db, hub.id)).items.length).toBeGreaterThan(0);
    });
  });

  // ---- Public hub reads are unaffected for anyone ----
  describe('public hub reads (unaffected)', () => {
    it('serves full detail + data to a non-member', async () => {
      const hub = (await getHubBySlug(db, pubHub.slug, strangerId))!;
      expect(hub.id).toBe(pubHub.id);
      expect(canReadHub(hub)).toBe(true);
      // owner is the sole member; roster resolves for a stranger
      expect((await listMembers(db, hub.id)).items.length).toBe(1);
    });

    it('serves full detail + data to anon', async () => {
      const hub = (await getHubBySlug(db, pubHub.slug))!;
      expect(hub.id).toBe(pubHub.id);
      expect(canReadHub(hub)).toBe(true);
    });
  });
});
