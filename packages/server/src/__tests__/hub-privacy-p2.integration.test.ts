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
import { hubMembers, contentItems, hubShares, events } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createHub,
  getHubBySlug,
  getHubIdBySlug,
  updateHub,
  canReadHub,
  canReadHubById,
  REDACTED_HUB_ID,
  createPost,
  listPosts,
  listMembers,
  createHubResource,
  listHubResources,
  listHubs,
  shareContent,
  listShares,
} from '../hub/index.js';
import { createProduct, listHubProducts, listHubGallery, getProductBySlug, searchProducts } from '../product/product.js';
import { createContent } from '../content/content.js';
import { createComment, listComments } from '../social/social.js';
import { listEvents } from '../events/events.js';

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

    // Events: a published event on the private hub (must NOT leak into the bare public feed)
    // and one on the public hub (must still appear — no over-block).
    await db.insert(events).values({
      title: 'P2 Secret Meetup', slug: 'p2-secret-meetup',
      startDate: new Date(Date.now() + 86_400_000), endDate: new Date(Date.now() + 90_000_000),
      status: 'published', hubId: priv.id, createdById: ownerId, onlineUrl: 'https://secret.example/join',
    });
    await db.insert(events).values({
      title: 'P2 Open Meetup', slug: 'p2-open-meetup',
      startDate: new Date(Date.now() + 86_400_000), endDate: new Date(Date.now() + 90_000_000),
      status: 'published', hubId: pubHub.id, createdById: ownerId,
    });
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

  // P-1b §2.1: private-hub events must not appear in the bare (unscoped) public events feed.
  describe('bare events feed (private-hub exclusion)', () => {
    it('excludes private-hub events but still serves public-hub events', async () => {
      const { items } = await listEvents(db, {});
      expect(items.some((e) => e.hubId === priv.id)).toBe(false);
      expect(items.some((e) => e.hubId === pubHub.id)).toBe(true);
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

  // ---- P-1b: listHubs directory shows PUBLIC hubs only ----
  describe('listHubs (P-1b directory privacy)', () => {
    it('excludes private hubs from the directory for everyone (unauth)', async () => {
      const { items } = await listHubs(db, { limit: 100 });
      const ids = items.map((h) => ('id' in h ? h.id : ''));
      expect(ids).toContain(pubHub.id);
      expect(ids).not.toContain(priv.id);
    });

    it('excludes an UNLISTED hub too (directory-hidden)', async () => {
      const unlisted = await createHub(db, ownerId, { name: 'P1b Unlisted Hub', privacy: 'unlisted' });
      const { items } = await listHubs(db, { limit: 100 });
      const ids = items.map((h) => ('id' in h ? h.id : ''));
      expect(ids).not.toContain(unlisted.id);
    });
  });

  // ---- P-1b: canReadHubById (event/by-id hub-scoped surfaces) ----
  describe('canReadHubById (P-1b)', () => {
    it('denies anon + non-member on a private hub, grants member/admin', async () => {
      expect(await canReadHubById(db, priv.id)).toBe(false);
      expect(await canReadHubById(db, priv.id, strangerId)).toBe(false);
      expect(await canReadHubById(db, priv.id, memberId)).toBe(true);
      expect(await canReadHubById(db, priv.id, strangerId, { asPlatformAdmin: true })).toBe(true);
    });
    it('grants everyone on a public hub', async () => {
      expect(await canReadHubById(db, pubHub.id)).toBe(true);
      expect(await canReadHubById(db, pubHub.id, strangerId)).toBe(true);
    });
    it('grants when the hub id is missing/deleted (owning entity stands alone)', async () => {
      expect(await canReadHubById(db, REDACTED_HUB_ID)).toBe(true);
    });
  });

  // ---- P-1b: product detail/search hide private-hub products ----
  describe('getProductBySlug / searchProducts (P-1b private-hub products)', () => {
    it('hides a private-hub product from anon + non-member, serves member/admin', async () => {
      const p = await createProduct(db, ownerId, priv.id, { name: 'P1b Secret Gizmo' });
      expect(await getProductBySlug(db, p.slug)).toBeNull(); // anon
      expect(await getProductBySlug(db, p.slug, strangerId)).toBeNull();
      expect(await getProductBySlug(db, p.slug, memberId)).not.toBeNull();
      expect(await getProductBySlug(db, p.slug, strangerId, { asPlatformAdmin: true })).not.toBeNull();
    });

    it('serves a public-hub product to anyone', async () => {
      const p = await createProduct(db, ownerId, pubHub.id, { name: 'P1b Open Gizmo' });
      expect(await getProductBySlug(db, p.slug)).not.toBeNull();
    });

    it('excludes private-hub products from search (bare + ?hubId enumeration)', async () => {
      const priv2 = await createHub(db, ownerId, { name: 'P1b Search Priv', privacy: 'private' });
      const secret = await createProduct(db, ownerId, priv2.id, { name: 'P1b Search Secret' });
      const open = await createProduct(db, ownerId, pubHub.id, { name: 'P1b Search Open' });

      const anon = await searchProducts(db, { limit: 100 });
      const anonIds = anon.items.map((i) => i.id);
      expect(anonIds).toContain(open.id);
      expect(anonIds).not.toContain(secret.id);

      // ?hubId=<private> must not enumerate the catalog for a non-member
      const enumAttempt = await searchProducts(db, { hubId: priv2.id, limit: 100 });
      expect(enumAttempt.items.map((i) => i.id)).not.toContain(secret.id);

      // a member of that private hub DOES see its products via search
      await db.insert(hubMembers).values({ hubId: priv2.id, userId: memberId, role: 'member', status: 'active' });
      const asMember = await searchProducts(db, { hubId: priv2.id, limit: 100 }, memberId);
      expect(asMember.items.map((i) => i.id)).toContain(secret.id);

      // platform admin sees everything
      const asAdmin = await searchProducts(db, { hubId: priv2.id, limit: 100 }, strangerId, { asPlatformAdmin: true });
      expect(asAdmin.items.map((i) => i.id)).toContain(secret.id);
    });
  });

  // ---- P-1b: shareContent WRITE gate (ownership/visibility) ----
  describe('shareContent (P-1b write gate)', () => {
    it('refuses to share another user\'s members/private item into a hub', async () => {
      // stranger is an active member of the public hub so membership passes
      await db.insert(hubMembers).values({ hubId: pubHub.id, userId: strangerId, role: 'member', status: 'active' });
      const secret = await createContent(db, ownerId, { type: 'project', title: 'P1b Not Yours', visibility: 'private' });
      await db.update(contentItems).set({ status: 'published', publishedAt: new Date() }).where(eq(contentItems.id, secret.id));

      const shared = await shareContent(db, strangerId, pubHub.id, secret.id);
      expect(shared).toBeNull();
      const shares = await listShares(db, pubHub.id);
      expect(shares.map((s) => s.contentId)).not.toContain(secret.id);
    });

    it('allows sharing the sharer\'s OWN private item (author bypass)', async () => {
      const mine = await createContent(db, strangerId, { type: 'project', title: 'P1b My Draft', visibility: 'private' });
      const shared = await shareContent(db, strangerId, pubHub.id, mine.id);
      expect(shared).not.toBeNull();
    });

    it('allows sharing a public published item', async () => {
      const pub = await createContent(db, ownerId, { type: 'project', title: 'P1b Public Share', visibility: 'public' });
      await db.update(contentItems).set({ status: 'published', publishedAt: new Date() }).where(eq(contentItems.id, pub.id));
      const shared = await shareContent(db, strangerId, pubHub.id, pub.id);
      expect(shared).not.toBeNull();
    });
  });
});
