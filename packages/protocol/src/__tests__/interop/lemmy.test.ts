/**
 * Interop tests: verify our parsers correctly handle real Lemmy AP payloads.
 * Fixtures based on Lemmy federation documentation.
 * https://join-lemmy.org/docs/contributors/05-federation.html
 */
import { describe, it, expect, vi } from 'vitest';
import { processInboxActivity, type InboxCallbacks } from '../../inbox';
import { validateActorResponse } from '../../actorResolver';

function createMockCallbacks(): InboxCallbacks {
  return {
    onFollow: vi.fn(),
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onUndo: vi.fn(),
    onCreate: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onLike: vi.fn(),
    onAnnounce: vi.fn(),
  };
}

// --- Lemmy Fixtures ---

const LEMMY_PERSON = {
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1',
    {
      'lemmy': 'https://join-lemmy.org/ns#',
    },
  ],
  type: 'Person',
  id: 'https://lemmy.world/u/alice',
  preferredUsername: 'alice',
  name: 'Alice',
  summary: 'Hardware enthusiast on Lemmy',
  inbox: 'https://lemmy.world/u/alice/inbox',
  outbox: 'https://lemmy.world/u/alice/outbox',
  publicKey: {
    id: 'https://lemmy.world/u/alice#main-key',
    owner: 'https://lemmy.world/u/alice',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----',
  },
  endpoints: {
    sharedInbox: 'https://lemmy.world/inbox',
  },
};

const LEMMY_GROUP = {
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1',
  ],
  type: 'Group',
  id: 'https://lemmy.world/c/electronics',
  preferredUsername: 'electronics',
  name: 'Electronics',
  summary: '<p>All things electronics</p>',
  inbox: 'https://lemmy.world/c/electronics/inbox',
  outbox: 'https://lemmy.world/c/electronics/outbox',
  followers: 'https://lemmy.world/c/electronics/followers',
  publicKey: {
    id: 'https://lemmy.world/c/electronics#main-key',
    owner: 'https://lemmy.world/c/electronics',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----',
  },
  endpoints: {
    sharedInbox: 'https://lemmy.world/inbox',
  },
  // Lemmy-specific: moderator list
  attributedTo: [
    'https://lemmy.world/u/admin',
    'https://lemmy.world/u/mod1',
  ],
};

const LEMMY_CREATE_PAGE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Create',
  id: 'https://lemmy.world/activities/create/abc123',
  actor: 'https://lemmy.world/u/alice',
  to: [
    'https://www.w3.org/ns/activitystreams#Public',
    'https://lemmy.world/c/electronics',
  ],
  cc: ['https://lemmy.world/c/electronics/followers'],
  audience: 'https://lemmy.world/c/electronics',
  object: {
    type: 'Page',
    id: 'https://lemmy.world/post/99999',
    attributedTo: 'https://lemmy.world/u/alice',
    name: 'Best oscilloscope under $200?',
    content: '<p>Looking for recommendations for a beginner oscilloscope. Budget is $200.</p>',
    url: 'https://lemmy.world/post/99999',
    published: '2026-03-20T08:00:00Z',
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: ['https://lemmy.world/c/electronics/followers'],
    audience: 'https://lemmy.world/c/electronics',
    // Lemmy uses commentsEnabled, sensitive, stickied, language
    commentsEnabled: true,
    sensitive: false,
  },
};

const LEMMY_ANNOUNCE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Announce',
  id: 'https://lemmy.world/activities/announce/def456',
  actor: 'https://lemmy.world/c/electronics',
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  cc: ['https://lemmy.world/c/electronics/followers'],
  // Lemmy wraps the FULL activity (not just object URI)
  object: {
    type: 'Create',
    id: 'https://lemmy.world/activities/create/abc123',
    actor: 'https://lemmy.world/u/alice',
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: ['https://lemmy.world/c/electronics/followers'],
    audience: 'https://lemmy.world/c/electronics',
    object: {
      type: 'Page',
      id: 'https://lemmy.world/post/99999',
      attributedTo: 'https://lemmy.world/u/alice',
      name: 'Best oscilloscope under $200?',
      content: '<p>Looking for recommendations...</p>',
    },
  },
};

const LEMMY_CREATE_NOTE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Create',
  id: 'https://lemmy.world/activities/create/ghi789',
  actor: 'https://lemmy.world/u/bob',
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  cc: ['https://lemmy.world/c/electronics/followers'],
  audience: 'https://lemmy.world/c/electronics',
  object: {
    type: 'Note',
    id: 'https://lemmy.world/comment/55555',
    attributedTo: 'https://lemmy.world/u/bob',
    content: '<p>I recommend the Rigol DS1054Z. Great value.</p>',
    inReplyTo: 'https://lemmy.world/post/99999',
    published: '2026-03-20T09:30:00Z',
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: ['https://lemmy.world/c/electronics/followers'],
    audience: 'https://lemmy.world/c/electronics',
  },
};

const LEMMY_LIKE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Like',
  id: 'https://lemmy.world/activities/like/xyz',
  actor: 'https://lemmy.world/u/bob',
  object: 'https://lemmy.world/post/99999',
  audience: 'https://lemmy.world/c/electronics',
};

const LEMMY_FOLLOW_COMMUNITY = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Follow',
  id: 'https://hack.build/activities/follow-community-1',
  actor: 'https://hack.build/users/carol',
  object: 'https://lemmy.world/c/electronics',
};

const LEMMY_BLOCK_USER = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Block',
  id: 'https://lemmy.world/activities/block/spam1',
  actor: 'https://lemmy.world/c/electronics',
  object: 'https://evil.instance/u/spammer',
  target: 'https://lemmy.world/c/electronics',
  audience: 'https://lemmy.world/c/electronics',
};

// --- Tests ---

describe('Lemmy interop: actor parsing', () => {
  it('parses a Lemmy Person actor', () => {
    const actor = validateActorResponse(LEMMY_PERSON);
    expect(actor).not.toBeNull();
    expect(actor!.type).toBe('Person');
    expect(actor!.id).toBe('https://lemmy.world/u/alice');
    expect(actor!.inbox).toBe('https://lemmy.world/u/alice/inbox');
    expect(actor!.endpoints?.sharedInbox).toBe('https://lemmy.world/inbox');
  });

  it('parses a Lemmy Group (community) actor', () => {
    const actor = validateActorResponse(LEMMY_GROUP);
    expect(actor).not.toBeNull();
    expect(actor!.type).toBe('Group');
    expect(actor!.id).toBe('https://lemmy.world/c/electronics');
    expect(actor!.preferredUsername).toBe('electronics');
    expect(actor!.inbox).toBe('https://lemmy.world/c/electronics/inbox');
    expect(actor!.followers).toBe('https://lemmy.world/c/electronics/followers');
  });
});

describe('Lemmy interop: inbox processing', () => {
  it('processes Create(Page) from Lemmy — community post', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(LEMMY_CREATE_PAGE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onCreate).toHaveBeenCalledWith(
      'https://lemmy.world/u/alice',
      expect.objectContaining({
        type: 'Page',
        name: 'Best oscilloscope under $200?',
      }),
    );
  });

  it('processes Announce from Lemmy community (wraps full activity)', async () => {
    const cbs = createMockCallbacks();
    // Lemmy's Announce wraps the full Create activity, not just a URI
    // Our current inbox.ts handles Announce with string object
    // This tests with an object — currently treated as string URI extraction
    const result = await processInboxActivity(LEMMY_ANNOUNCE, cbs);

    // Note: current implementation expects Announce.object to be a string URI.
    // With Lemmy's full-activity Announce, it gets the inner object.
    // This test documents the current behavior — may need adjustment in Phase 6.
    expect(result.success).toBe(true);
  });

  it('processes Create(Note) from Lemmy — comment', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(LEMMY_CREATE_NOTE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onCreate).toHaveBeenCalledWith(
      'https://lemmy.world/u/bob',
      expect.objectContaining({
        type: 'Note',
        inReplyTo: 'https://lemmy.world/post/99999',
      }),
    );
  });

  it('processes Like from Lemmy (upvote)', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(LEMMY_LIKE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onLike).toHaveBeenCalledWith(
      'https://lemmy.world/u/bob',
      'https://lemmy.world/post/99999',
    );
  });

  it('processes Follow for Lemmy community', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(LEMMY_FOLLOW_COMMUNITY, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onFollow).toHaveBeenCalledWith(
      'https://hack.build/users/carol',
      'https://lemmy.world/c/electronics',
      'https://hack.build/activities/follow-community-1',
    );
  });

  it('handles Block activity from Lemmy (unsupported type)', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(LEMMY_BLOCK_USER, cbs);

    // Block is not yet supported — should return error gracefully
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported');
  });
});

describe('Lemmy interop: key observations', () => {
  it('Lemmy uses Page type for posts (not Note or Article)', () => {
    const object = LEMMY_CREATE_PAGE.object;
    expect(object.type).toBe('Page');
    // Phase 2/5 needs to handle Page → content mapping
  });

  it('Lemmy includes audience field for community context', () => {
    expect(LEMMY_CREATE_PAGE.audience).toBe('https://lemmy.world/c/electronics');
    expect(LEMMY_CREATE_NOTE.audience).toBe('https://lemmy.world/c/electronics');
    expect(LEMMY_LIKE.audience).toBe('https://lemmy.world/c/electronics');
    // Phase 6 needs to use audience field to route to correct hub
  });

  it('Lemmy Announce wraps full activity object, not just URI', () => {
    const announceObject = LEMMY_ANNOUNCE.object;
    expect(typeof announceObject).toBe('object');
    expect(announceObject.type).toBe('Create');
    // Phase 6 inbox handler must unwrap the inner activity
  });

  it('Lemmy Group actor has attributedTo for moderators', () => {
    const group = LEMMY_GROUP;
    expect(group.attributedTo).toEqual([
      'https://lemmy.world/u/admin',
      'https://lemmy.world/u/mod1',
    ]);
    // Phase 6 can extract moderator list from Group actor
  });
});
