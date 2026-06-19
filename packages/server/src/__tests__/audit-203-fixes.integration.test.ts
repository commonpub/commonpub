/**
 * Proving tests for the security/correctness fixes landed on the
 * `audit-203-fixes` branch. Each `describe` block exercises a single fixed
 * server function against the real PGlite test DB (no mocks). The fixtures
 * (hub + member + ban, draft + published docs page, etc.) are built end-to-end
 * through the real helpers so reverting the fix in source makes the relevant
 * assertion go red.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';

import { createHub, getHubBySlug } from '../hub/hub.js';
import { joinHub } from '../hub/members.js';
import { createPost } from '../hub/posts.js';
import { banUser } from '../hub/moderation.js';
import { createProduct } from '../product/product.js';
import { voteOnPost, voteOnPoll, createPollOptions } from '../voting/voting.js';
import { createEvent } from '../events/events.js';
import { createVideoCategory } from '../video/video.js';
import {
  createDocsSite,
  createDocsPage,
  listDocsPages,
  searchDocsPages,
} from '../docs/docs.js';
import { docsVersions } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

// --- Fix 1: products IDOR (createProduct hub-membership guard) -----------------

describe('fix 1 — createProduct requires hub membership (IDOR)', () => {
  let db: DB;
  let ownerId: string;
  let nonMemberId: string;
  let memberId: string;
  let hubId: string;

  beforeAll(async () => {
    db = await createTestDB();
    ownerId = (await createTestUser(db, { username: 'prod-owner' })).id;
    nonMemberId = (await createTestUser(db, { username: 'prod-nonmember' })).id;
    memberId = (await createTestUser(db, { username: 'prod-member' })).id;

    const hub = await createHub(db, ownerId, { name: 'Product IDOR Hub' });
    hubId = hub.id;
    await joinHub(db, memberId, hubId);
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('rejects a non-member with "Must be a hub member to add products"', async () => {
    await expect(
      createProduct(db, nonMemberId, hubId, { name: 'Sneaky Board' }),
    ).rejects.toThrow(/Must be a hub member to add products/);
  });

  it('allows a hub member to create a product', async () => {
    const product = await createProduct(db, memberId, hubId, {
      name: 'Legit Board',
    });
    expect(product.id).toBeDefined();
    expect(product.name).toBe('Legit Board');
  });
});

// --- Fix 2: hub vote/poll membership + ban guard ------------------------------

describe('fix 2 — voteOnPost / voteOnPoll reject non-members and banned users', () => {
  let db: DB;
  let ownerId: string;
  let memberId: string;
  let nonMemberId: string;
  let bannedId: string;
  let hubId: string;
  let postId: string;
  let pollPostId: string;
  let pollOptionId: string;

  beforeAll(async () => {
    db = await createTestDB();
    ownerId = (await createTestUser(db, { username: 'vote-owner' })).id;
    memberId = (await createTestUser(db, { username: 'vote-member' })).id;
    nonMemberId = (await createTestUser(db, { username: 'vote-nonmember' })).id;
    bannedId = (await createTestUser(db, { username: 'vote-banned' })).id;

    const hub = await createHub(db, ownerId, { name: 'Voting Guard Hub' });
    hubId = hub.id;

    await joinHub(db, memberId, hubId);

    // bannedId joins, then is banned by the owner.
    await joinHub(db, bannedId, hubId);
    await banUser(db, ownerId, hubId, bannedId, 'Test ban for voting');

    // Owner authors a regular post + a poll post.
    const post = await createPost(db, ownerId, {
      hubId,
      type: 'text',
      content: 'Vote on me',
    });
    postId = post.id;

    const pollPost = await createPost(db, ownerId, {
      hubId,
      type: 'poll',
      content: 'Pick one',
    });
    pollPostId = pollPost.id;
    const options = await createPollOptions(db, pollPostId, ['A', 'B']);
    pollOptionId = options[0]!.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('voteOnPost: non-member is rejected (voted:false, score unchanged)', async () => {
    const result = await voteOnPost(db, postId, nonMemberId, 'up');
    expect(result.voted).toBe(false);
    expect(result.voteScore).toBe(0);
  });

  it('voteOnPost: banned user is rejected (voted:false, score unchanged)', async () => {
    const result = await voteOnPost(db, postId, bannedId, 'up');
    expect(result.voted).toBe(false);
    expect(result.voteScore).toBe(0);
  });

  it('voteOnPost: member succeeds and voteScore changes', async () => {
    const result = await voteOnPost(db, postId, memberId, 'up');
    expect(result.voted).toBe(true);
    expect(result.voteScore).toBe(1);
  });

  it('voteOnPoll: non-member is rejected with an error', async () => {
    const result = await voteOnPoll(db, pollPostId, pollOptionId, nonMemberId);
    expect(result.voted).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('voteOnPoll: banned user is rejected with an error', async () => {
    const result = await voteOnPoll(db, pollPostId, pollOptionId, bannedId);
    expect(result.voted).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('voteOnPoll: member succeeds', async () => {
    const result = await voteOnPoll(db, pollPostId, pollOptionId, memberId);
    expect(result.voted).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

// --- Fix 3: private hub metadata redaction for non-members --------------------

describe('fix 3 — getHubBySlug redacts private-hub metadata from non-members', () => {
  let db: DB;
  let ownerId: string;
  let nonMemberId: string;
  let slug: string;

  beforeAll(async () => {
    db = await createTestDB();
    ownerId = (await createTestUser(db, { username: 'priv-owner' })).id;
    nonMemberId = (await createTestUser(db, { username: 'priv-nonmember' })).id;

    const hub = await createHub(db, ownerId, {
      name: 'Secret Hub',
      privacy: 'private',
      description: 'Members-only description',
      rules: 'Members-only rules',
      website: 'https://secret.example.com',
    });
    slug = hub.slug;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('nulls description/rules/website for a non-member requester', async () => {
    const view = await getHubBySlug(db, slug, nonMemberId);
    expect(view).not.toBeNull();
    expect(view!.privacy).toBe('private');
    expect(view!.currentUserRole).toBeNull();
    expect(view!.description).toBeNull();
    expect(view!.rules).toBeNull();
    expect(view!.website).toBeNull();
  });

  it('nulls metadata for an anonymous (no requesterId) caller', async () => {
    const view = await getHubBySlug(db, slug);
    expect(view).not.toBeNull();
    expect(view!.description).toBeNull();
    expect(view!.rules).toBeNull();
    expect(view!.website).toBeNull();
  });

  it('returns full metadata for the owner', async () => {
    const view = await getHubBySlug(db, slug, ownerId);
    expect(view).not.toBeNull();
    expect(view!.description).toBe('Members-only description');
    expect(view!.rules).toBe('Members-only rules');
    expect(view!.website).toBe('https://secret.example.com');
  });
});

// --- Fix 4: createEvent slug de-dup ------------------------------------------

describe('fix 4 — createEvent de-dups slug on identical titles', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    userId = (await createTestUser(db, { username: 'event-creator' })).id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('two events with the same title get distinct slugs (no unique violation)', async () => {
    const base = {
      title: 'Maker Faire',
      slug: 'maker-faire',
      startDate: '2026-07-01T10:00:00.000Z',
      endDate: '2026-07-01T18:00:00.000Z',
      createdBy: userId,
    };

    const first = await createEvent(db, { ...base });
    const second = await createEvent(db, { ...base });

    expect(first.slug).toBeDefined();
    expect(second.slug).toBeDefined();
    expect(second.slug).not.toBe(first.slug);
  });
});

// --- Fix 5: video category slug de-dup ---------------------------------------

describe('fix 5 — createVideoCategory de-dups slug on colliding names', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // NOTE: video_categories.name is itself UNIQUE, so two *identical* names can
  // never coexist. The slug.UNIQUE collision the fix guards against happens when
  // two *distinct* names slugify to the same value (generateSlug strips
  // punctuation): "Robotics" and "Robotics!" both produce slug "robotics".
  it('two distinct names that slugify identically get distinct slugs (no unique violation)', async () => {
    const first = await createVideoCategory(db, { name: 'Robotics' });
    const second = await createVideoCategory(db, { name: 'Robotics!' });

    expect(first.slug).toBe('robotics');
    expect(second.slug).toBeDefined();
    expect(second.slug).not.toBe(first.slug);
  });
});

// --- Fix 6: docs publishedOnly filter ----------------------------------------

describe('fix 6 — listDocsPages / searchDocsPages honor publishedOnly', () => {
  let db: DB;
  let ownerId: string;
  let siteId: string;
  let versionId: string;

  beforeAll(async () => {
    db = await createTestDB();
    ownerId = (await createTestUser(db, { username: 'docs-author' })).id;

    const site = await createDocsSite(db, ownerId, { name: 'Filter Docs' });
    siteId = site.id;
    const versions = await db
      .select()
      .from(docsVersions)
      .where(eq(docsVersions.siteId, siteId));
    versionId = versions[0]!.id;

    await createDocsPage(db, ownerId, {
      versionId,
      title: 'Published Guide',
      slug: 'published-guide',
      status: 'published',
      content: [['paragraph', { html: '<p>Stabilizer firmware overview.</p>' }]],
    });

    await createDocsPage(db, ownerId, {
      versionId,
      title: 'Draft Guide',
      slug: 'draft-guide',
      status: 'draft',
      content: [['paragraph', { html: '<p>Stabilizer firmware overview.</p>' }]],
    });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('listDocsPages with publishedOnly:true returns ONLY the published page', async () => {
    const pages = await listDocsPages(db, versionId, { publishedOnly: true });
    const titles = pages.map((p) => p.title);
    expect(titles).toContain('Published Guide');
    expect(titles).not.toContain('Draft Guide');
  });

  it('listDocsPages default (no opts) returns both draft and published', async () => {
    const pages = await listDocsPages(db, versionId);
    const titles = pages.map((p) => p.title);
    expect(titles).toContain('Published Guide');
    expect(titles).toContain('Draft Guide');
  });

  it('searchDocsPages with publishedOnly:true excludes the draft', async () => {
    const results = await searchDocsPages(
      db,
      siteId,
      versionId,
      'stabilizer',
      'english',
      { publishedOnly: true },
    );
    const titles = results.map((r) => r.title);
    expect(titles).toContain('Published Guide');
    expect(titles).not.toContain('Draft Guide');
  });

  it('searchDocsPages default (no opts) includes the draft', async () => {
    const results = await searchDocsPages(db, siteId, versionId, 'stabilizer');
    const titles = results.map((r) => r.title);
    expect(titles).toContain('Published Guide');
    expect(titles).toContain('Draft Guide');
  });
});
