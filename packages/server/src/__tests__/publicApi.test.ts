import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateApiKey,
  hashApiKey,
  compareKeyHash,
  extractPrefix,
  hasScope,
  ApiKeyRateLimit,
  toPublicUser,
  isPublicUser,
  toPublicContentSummary,
  isPublicContent,
  toPublicHub,
  isPublicHub,
  type PublicUserRow,
  type PublicContentRow,
  type PublicHubRow,
} from '../publicApi/index.js';

describe('publicApi/keys', () => {
  it('generates a token, prefix, and hash that round-trip', () => {
    const { token, prefix, keyHash } = generateApiKey();
    expect(token.startsWith('cpub_live_ak_')).toBe(true);
    expect(prefix.length).toBe(24);
    expect(token.startsWith(prefix)).toBe(true);
    expect(keyHash).toBe(hashApiKey(token));
    expect(compareKeyHash(hashApiKey(token), keyHash)).toBe(true);
  });

  it('rejects a tampered hash', () => {
    const { keyHash } = generateApiKey();
    const wrong = 'x'.repeat(64);
    expect(compareKeyHash(wrong, keyHash)).toBe(false);
  });

  it('rejects hashes of mismatched length without crashing', () => {
    expect(compareKeyHash('deadbeef', 'a'.repeat(64))).toBe(false);
  });

  it('extractPrefix returns null for bad formats', () => {
    expect(extractPrefix(undefined as unknown as string)).toBe(null);
    expect(extractPrefix('bearer abc')).toBe(null);
    expect(extractPrefix('cpub_live_ak_')).toBe(null); // too short
    expect(extractPrefix('CPUB_live_ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx')).toBe(null); // case
  });

  it('generates unique tokens across many calls', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateApiKey().token);
    }
    expect(tokens.size).toBe(100);
  });
});

describe('publicApi/scopes', () => {
  it('direct match', () => {
    expect(hasScope(['read:content'], 'read:content')).toBe(true);
  });
  it('wildcard read:* matches any read scope', () => {
    expect(hasScope(['read:*'], 'read:content')).toBe(true);
    expect(hasScope(['read:*'], 'read:hubs')).toBe(true);
  });
  it('missing scope is denied', () => {
    expect(hasScope(['read:hubs'], 'read:content')).toBe(false);
  });
  it('empty grant denies everything', () => {
    expect(hasScope([], 'read:content')).toBe(false);
  });
});

describe('publicApi/rateLimit', () => {
  let rl: ApiKeyRateLimit;
  beforeEach(() => { rl = new ApiKeyRateLimit(60_000); });

  it('allows up to the limit and rejects the next call', () => {
    for (let i = 0; i < 5; i++) {
      const r = rl.check('key1', 5);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(5 - i - 1);
    }
    const next = rl.check('key1', 5);
    expect(next.allowed).toBe(false);
    expect(next.remaining).toBe(0);
  });

  it('keys do not share buckets', () => {
    for (let i = 0; i < 5; i++) rl.check('a', 5);
    const b = rl.check('b', 5);
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(4);
  });
});

describe('publicApi/serializers — PII leak guards', () => {
  const rawUser = {
    id: 'u1',
    username: 'alice',
    displayName: 'Alice',
    headline: 'Maker',
    bio: 'I make things',
    avatarUrl: null,
    bannerUrl: null,
    pronouns: 'she/her',
    location: 'EU',
    website: null,
    skills: ['js'],
    socialLinks: { github: 'alice' },
    profileVisibility: 'public',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    // Fields that must NEVER appear in the serialized output:
    email: 'alice@secret.com',
    emailVerified: true,
    passwordHash: 'hunter2',
    role: 'admin',
    status: 'active',
    emailNotifications: { digest: 'daily' },
  };

  it('toPublicUser omits email, role, status, and password fields', () => {
    const out = toPublicUser(rawUser as unknown as PublicUserRow);
    const serialized = JSON.stringify(out);
    for (const forbidden of ['email', 'passwordHash', 'role', 'status', 'emailNotifications', 'emailVerified']) {
      expect(serialized).not.toMatch(new RegExp(`"${forbidden}"`));
    }
    // Positive check: public fields are present.
    expect(out.username).toBe('alice');
    expect(out.headline).toBe('Maker');
  });

  it('isPublicUser filters out deleted and non-public profiles', () => {
    expect(isPublicUser({ ...rawUser, deletedAt: new Date() } as PublicUserRow)).toBe(false);
    expect(isPublicUser({ ...rawUser, profileVisibility: 'private' } as PublicUserRow)).toBe(false);
    expect(isPublicUser(rawUser as unknown as PublicUserRow)).toBe(true);
  });

  it('isPublicContent rejects drafts, deleted, non-public visibility', () => {
    const base = {
      id: 'c1', type: 'blog', title: 't', slug: 's', description: null, coverImageUrl: null,
      difficulty: null, publishedAt: null, updatedAt: new Date(), viewCount: 0, likeCount: 0,
      commentCount: 0, author: { id: 'u', username: 'u', displayName: null, avatarUrl: null },
      status: 'published', visibility: 'public', deletedAt: null,
    } as PublicContentRow;
    expect(isPublicContent(base)).toBe(true);
    expect(isPublicContent({ ...base, status: 'draft' })).toBe(false);
    expect(isPublicContent({ ...base, visibility: 'private' })).toBe(false);
    expect(isPublicContent({ ...base, visibility: 'unlisted' })).toBe(false);
    expect(isPublicContent({ ...base, deletedAt: new Date() })).toBe(false);
  });

  it('toPublicContentSummary builds a canonicalUrl and drops unlisted fields', () => {
    const row = {
      id: 'c1', type: 'blog', title: 'Hello', slug: 'hello',
      description: 'd', coverImageUrl: null, difficulty: null,
      status: 'published', visibility: 'public', publishedAt: new Date('2026-04-01T00:00:00Z'),
      updatedAt: new Date('2026-04-02T00:00:00Z'), deletedAt: null,
      viewCount: 5, likeCount: 2, commentCount: 1,
      author: { id: 'u1', username: 'alice', displayName: 'Alice', avatarUrl: null },
      // Try to smuggle a private field through — should not appear in output.
      moderationNotes: 'FLAGGED',
    } as unknown as PublicContentRow;
    const out = toPublicContentSummary(row, 'example.com');
    expect(JSON.stringify(out)).not.toMatch(/moderationNotes|FLAGGED/);
    expect(out.canonicalUrl).toBe('https://example.com/u/alice/blog/hello');
  });

  it('toPublicHub ignores private rows and builds canonicalUrl', () => {
    const row = {
      id: 'h1', name: 'Hub', slug: 'hub', description: null,
      hubType: 'community', iconUrl: null, bannerUrl: null,
      memberCount: 3, postCount: 0, isOfficial: false, categories: null,
      website: null, deletedAt: null, createdAt: new Date('2026-01-01T00:00:00Z'),
      // must-not-leak field:
      internalModerationRules: { banned: ['x'] },
    } as unknown as PublicHubRow;
    const out = toPublicHub(row, 'example.com');
    expect(JSON.stringify(out)).not.toMatch(/internalModerationRules|banned/);
    expect(out.canonicalUrl).toBe('https://example.com/hubs/hub');
    expect(isPublicHub(row)).toBe(true);
    expect(isPublicHub({ ...row, deletedAt: new Date() })).toBe(false);
  });
});

// --- Phase 2 serializers ---

describe('publicApi/serializers — phase 2 PII guards', () => {
  const expectNoPrivate = (out: unknown) => {
    const s = JSON.stringify(out);
    for (const forbidden of ['email', 'passwordHash', 'passwordResetToken', 'role', 'sessions', 'moderationNotes', 'internalFlag']) {
      expect(s).not.toMatch(new RegExp(`"${forbidden}"`));
    }
  };

  it('toPublicLearningPath omits private fields', async () => {
    const { toPublicLearningPath, isPublicLearningPath } = await import('../publicApi/index.js');
    const row: any = {
      id: 'p1', title: 'Intro', slug: 'intro', description: null,
      coverImageUrl: null, difficulty: 'beginner', status: 'published',
      lessonCount: 5, enrollmentCount: 10, publishedAt: new Date(),
      createdAt: new Date('2026-01-01'), deletedAt: null,
      author: { id: 'u1', username: 'alice', displayName: null, avatarUrl: null },
      internalFlag: 'SECRET',
    };
    expect(isPublicLearningPath(row)).toBe(true);
    expect(isPublicLearningPath({ ...row, status: 'draft' })).toBe(false);
    expect(isPublicLearningPath({ ...row, deletedAt: new Date() })).toBe(false);
    const out = toPublicLearningPath(row, 'example.com');
    expectNoPrivate(out);
    expect(out.canonicalUrl).toBe('https://example.com/learn/intro');
  });

  it('toPublicEvent omits deletedAt and private fields', async () => {
    const { toPublicEvent, isPublicEvent } = await import('../publicApi/index.js');
    const row: any = {
      id: 'e1', title: 'Meetup', slug: 'meetup', description: null,
      coverImageUrl: null, eventType: 'in_person', status: 'published',
      location: 'Berlin', locationUrl: null, startAt: new Date('2026-06-01'),
      endAt: null, timezone: 'Europe/Berlin', capacity: 50,
      attendeeCount: 10, waitlistCount: 0, hubId: null,
      createdAt: new Date('2026-01-01'), deletedAt: null, host: null,
      internalFlag: 'SECRET',
    };
    expect(isPublicEvent(row)).toBe(true);
    expect(isPublicEvent({ ...row, status: 'cancelled' })).toBe(false);
    const out = toPublicEvent(row, 'example.com');
    expectNoPrivate(out);
    expect(out.canonicalUrl).toBe('https://example.com/events/meetup');
  });

  it('toPublicContest: only public statuses pass isPublicContest', async () => {
    const { toPublicContest, isPublicContest } = await import('../publicApi/index.js');
    const row: any = {
      id: 'c1', title: 'Edge AI', slug: 'edge-ai', description: null, bannerUrl: null,
      status: 'active', startDate: new Date('2026-01-01'), endDate: new Date('2026-06-01'),
      entryDeadline: null, judgingDeadline: null, prizeDescription: null,
      entryCount: 5, communityVotingEnabled: true,
      createdAt: new Date('2026-01-01'), deletedAt: null,
      internalFlag: 'SECRET',
    };
    expect(isPublicContest(row)).toBe(true);
    expect(isPublicContest({ ...row, status: 'draft' })).toBe(false);
    expect(isPublicContest({ ...row, status: 'cancelled' })).toBe(false);
    const out = toPublicContest(row, 'example.com');
    expectNoPrivate(out);
    expect(out.canonicalUrl).toBe('https://example.com/contests/edge-ai');
  });

  it('toPublicVideo drops unlisted fields', async () => {
    const { toPublicVideo, isPublicVideo } = await import('../publicApi/index.js');
    const row: any = {
      id: 'v1', title: 'Video', description: null,
      url: 'https://youtube.com/watch?v=x', embedUrl: null, thumbnailUrl: null,
      duration: 120, category: null, viewCount: 3, likeCount: 1,
      createdAt: new Date('2026-01-01'), deletedAt: null,
      author: { id: 'u1', username: 'alice', displayName: null, avatarUrl: null },
      internalFlag: 'SECRET',
    };
    expect(isPublicVideo(row)).toBe(true);
    expect(isPublicVideo({ ...row, deletedAt: new Date() })).toBe(false);
    const out = toPublicVideo(row, 'example.com');
    expectNoPrivate(out);
    expect(out.canonicalUrl).toBe('https://example.com/videos/v1');
  });

  it('toPublicDocSite drops unlisted fields', async () => {
    const { toPublicDocSite, isPublicDocSite } = await import('../publicApi/index.js');
    const row: any = {
      id: 'd1', name: 'Getting Started', slug: 'getting-started', description: null,
      pageCount: 10, versionCount: 2, defaultVersion: 'v2',
      createdAt: new Date('2026-01-01'), deletedAt: null,
      owner: { id: 'u1', username: 'alice', displayName: null },
      internalFlag: 'SECRET',
    };
    expect(isPublicDocSite(row)).toBe(true);
    const out = toPublicDocSite(row, 'example.com');
    expectNoPrivate(out);
    expect(out.canonicalUrl).toBe('https://example.com/docs/getting-started');
  });

  it('toPublicTag builds canonicalUrl and strips extras', async () => {
    const { toPublicTag } = await import('../publicApi/index.js');
    const row: any = { id: 't1', name: 'Robotics', slug: 'robotics', usageCount: 42, internalFlag: 'SECRET' };
    const out = toPublicTag(row, 'example.com');
    expectNoPrivate(out);
    expect(out.canonicalUrl).toBe('https://example.com/tags/robotics');
    expect(out.usageCount).toBe(42);
  });
});

describe('publicApi/serializers — source/origin on PublicContentSummary', () => {
  it('local items get source=local and null sourceDomain/sourceUri', async () => {
    const { toPublicContentSummary } = await import('../publicApi/index.js');
    const row: any = {
      id: 'c1', type: 'blog', title: 't', slug: 's', description: null, coverImageUrl: null,
      difficulty: null, status: 'published', visibility: 'public',
      publishedAt: new Date(), updatedAt: new Date(), deletedAt: null,
      viewCount: 0, likeCount: 0, commentCount: 0,
      author: { id: 'u', username: 'u', displayName: null, avatarUrl: null },
    };
    const out = toPublicContentSummary(row, 'example.com');
    expect(out.source).toBe('local');
    expect(out.sourceDomain).toBe(null);
    expect(out.sourceUri).toBe(null);
    expect(out.canonicalUrl).toBe('https://example.com/u/u/blog/s');
  });

  it('federated items report source and prefer sourceUri as canonicalUrl', async () => {
    const { toPublicContentSummary } = await import('../publicApi/index.js');
    const row: any = {
      id: 'c1', type: 'blog', title: 't', slug: 'mirror-abc', description: null, coverImageUrl: null,
      difficulty: null, status: 'published', visibility: 'public',
      publishedAt: new Date(), updatedAt: new Date(), deletedAt: null,
      viewCount: 0, likeCount: 0, commentCount: 0,
      author: { id: 'u', username: 'alice', displayName: null, avatarUrl: null },
      source: 'federated',
      sourceDomain: 'deveco.io',
      sourceUri: 'https://deveco.io/u/alice/blog/real-slug',
    };
    const out = toPublicContentSummary(row, 'example.com');
    expect(out.source).toBe('federated');
    expect(out.sourceDomain).toBe('deveco.io');
    expect(out.canonicalUrl).toBe('https://deveco.io/u/alice/blog/real-slug');
  });
});
