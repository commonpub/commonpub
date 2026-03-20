/**
 * Interop tests: verify our parsers handle GoToSocial AP payloads.
 * GoToSocial is Mastodon-compatible and the simplest AP implementation to test against.
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

// --- GoToSocial Fixtures ---

const GTS_PERSON = {
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1',
  ],
  type: 'Person',
  id: 'https://gts.example.org/users/alice',
  preferredUsername: 'alice',
  name: 'Alice GTS',
  summary: '<p>Testing from GoToSocial</p>',
  inbox: 'https://gts.example.org/users/alice/inbox',
  outbox: 'https://gts.example.org/users/alice/outbox',
  followers: 'https://gts.example.org/users/alice/followers',
  following: 'https://gts.example.org/users/alice/following',
  url: 'https://gts.example.org/@alice',
  publicKey: {
    id: 'https://gts.example.org/users/alice/main-key',
    owner: 'https://gts.example.org/users/alice',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----',
  },
  endpoints: {
    sharedInbox: 'https://gts.example.org/inbox',
  },
  // GoToSocial uses discoverable boolean like Mastodon
  discoverable: true,
};

const GTS_CREATE_NOTE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Create',
  id: 'https://gts.example.org/users/alice/statuses/01ABCDEF/activity',
  actor: 'https://gts.example.org/users/alice',
  published: '2026-03-20T14:00:00Z',
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  cc: ['https://gts.example.org/users/alice/followers'],
  object: {
    type: 'Note',
    id: 'https://gts.example.org/users/alice/statuses/01ABCDEF',
    attributedTo: 'https://gts.example.org/users/alice',
    content: '<p>Just built a custom mech keyboard! 🎹</p>',
    url: 'https://gts.example.org/@alice/statuses/01ABCDEF',
    published: '2026-03-20T14:00:00Z',
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: ['https://gts.example.org/users/alice/followers'],
    attachment: [
      {
        type: 'Document',
        mediaType: 'image/jpeg',
        url: 'https://gts.example.org/fileserver/01ABCDEF/attachment/keyboard.jpg',
        name: 'A custom mechanical keyboard',
        blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
        width: 1200,
        height: 800,
      },
    ],
    tag: [],
    sensitive: false,
  },
};

const GTS_FOLLOW = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Follow',
  id: 'https://gts.example.org/users/alice/follow/01XYZ',
  actor: 'https://gts.example.org/users/alice',
  object: 'https://hack.build/users/bob',
};

const GTS_LIKE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Like',
  id: 'https://gts.example.org/users/alice/liked/01FAVE',
  actor: 'https://gts.example.org/users/alice',
  object: 'https://hack.build/content/keyboard-guide',
};

const GTS_ANNOUNCE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Announce',
  id: 'https://gts.example.org/users/alice/statuses/01BOOST/activity',
  actor: 'https://gts.example.org/users/alice',
  published: '2026-03-20T15:00:00Z',
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  cc: ['https://gts.example.org/users/alice/followers'],
  object: 'https://hack.build/content/keyboard-guide',
};

// --- Tests ---

describe('GoToSocial interop: actor parsing', () => {
  it('parses GoToSocial Person actor', () => {
    const actor = validateActorResponse(GTS_PERSON);
    expect(actor).not.toBeNull();
    expect(actor!.type).toBe('Person');
    expect(actor!.id).toBe('https://gts.example.org/users/alice');
    expect(actor!.preferredUsername).toBe('alice');
    expect(actor!.inbox).toBe('https://gts.example.org/users/alice/inbox');
    expect(actor!.endpoints?.sharedInbox).toBe('https://gts.example.org/inbox');
  });

  it('handles GoToSocial key ID format (path-based, not fragment)', () => {
    // GoToSocial uses /main-key path instead of #main-key fragment
    expect(GTS_PERSON.publicKey.id).toBe('https://gts.example.org/users/alice/main-key');
    const actor = validateActorResponse(GTS_PERSON);
    expect(actor!.publicKey?.id).toBe('https://gts.example.org/users/alice/main-key');
  });
});

describe('GoToSocial interop: inbox processing', () => {
  it('processes Create(Note) from GoToSocial', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(GTS_CREATE_NOTE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onCreate).toHaveBeenCalledWith(
      'https://gts.example.org/users/alice',
      expect.objectContaining({
        type: 'Note',
        content: expect.stringContaining('custom mech keyboard'),
      }),
    );
  });

  it('processes Follow from GoToSocial', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(GTS_FOLLOW, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onFollow).toHaveBeenCalledWith(
      'https://gts.example.org/users/alice',
      'https://hack.build/users/bob',
      'https://gts.example.org/users/alice/follow/01XYZ',
    );
  });

  it('processes Like from GoToSocial', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(GTS_LIKE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onLike).toHaveBeenCalledWith(
      'https://gts.example.org/users/alice',
      'https://hack.build/content/keyboard-guide',
    );
  });

  it('processes Announce (boost) from GoToSocial', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(GTS_ANNOUNCE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onAnnounce).toHaveBeenCalledWith(
      'https://gts.example.org/users/alice',
      'https://hack.build/content/keyboard-guide',
    );
  });
});

describe('GoToSocial interop: key observations', () => {
  it('uses Document type for attachments (not Image)', () => {
    const attachment = GTS_CREATE_NOTE.object.attachment[0];
    expect(attachment.type).toBe('Document');
    // Phase 2 content mapper should handle both Image and Document attachments
  });

  it('includes blurhash in attachments', () => {
    const attachment = GTS_CREATE_NOTE.object.attachment[0];
    expect(attachment.blurhash).toBeDefined();
    // Can be stored in cpub_metadata for display
  });

  it('uses ULID-style IDs (not numeric)', () => {
    expect(GTS_CREATE_NOTE.object.id).toContain('01ABCDEF');
    // Our parsers should not assume any ID format
  });
});
