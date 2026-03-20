/**
 * Interop tests: verify our parsers handle Misskey/Sharkey AP payloads.
 * Misskey has several non-standard extensions (reactions, quotes, polls).
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

// --- Misskey Fixtures ---

const MISSKEY_PERSON = {
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1',
    {
      'misskey': 'https://misskey-hub.net/ns#',
      'isCat': 'misskey:isCat',
      'vcard': 'http://www.w3.org/2006/vcard/ns#',
    },
  ],
  type: 'Person',
  id: 'https://misskey.io/users/9abc12345',
  preferredUsername: 'alice',
  name: 'Alice 🔧',
  summary: '<p>Building cool things on Misskey</p>',
  inbox: 'https://misskey.io/users/9abc12345/inbox',
  outbox: 'https://misskey.io/users/9abc12345/outbox',
  followers: 'https://misskey.io/users/9abc12345/followers',
  following: 'https://misskey.io/users/9abc12345/following',
  url: 'https://misskey.io/@alice',
  publicKey: {
    id: 'https://misskey.io/users/9abc12345#main-key',
    owner: 'https://misskey.io/users/9abc12345',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----',
  },
  endpoints: {
    sharedInbox: 'https://misskey.io/inbox',
  },
  // Misskey extensions
  'misskey:isCat': false,
  'vcard:Address': 'Tokyo, Japan',
};

const MISSKEY_CREATE_NOTE = {
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    {
      'misskey': 'https://misskey-hub.net/ns#',
      '_misskey_content': 'misskey:_misskey_content',
      '_misskey_quote': 'misskey:_misskey_quote',
    },
  ],
  type: 'Create',
  id: 'https://misskey.io/notes/9xyz/activity',
  actor: 'https://misskey.io/users/9abc12345',
  published: '2026-03-20T16:00:00Z',
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  cc: ['https://misskey.io/users/9abc12345/followers'],
  object: {
    type: 'Note',
    id: 'https://misskey.io/notes/9xyz',
    attributedTo: 'https://misskey.io/users/9abc12345',
    content: '<p><span>Just finished my latest project!</span></p>',
    published: '2026-03-20T16:00:00Z',
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: ['https://misskey.io/users/9abc12345/followers'],
    // Misskey-specific: original MFM (Misskey Flavored Markdown) source
    '_misskey_content': 'Just finished my latest project!',
    tag: [
      { type: 'Hashtag', href: 'https://misskey.io/tags/electronics', name: '#electronics' },
    ],
    attachment: [],
    sensitive: false,
  },
};

// Misskey uses Like with custom emoji content for reactions
const MISSKEY_REACTION = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Like',
  id: 'https://misskey.io/likes/react123',
  actor: 'https://misskey.io/users/9abc12345',
  object: 'https://hack.build/content/robot-arm',
  // Misskey sends emoji in the content field for reactions
  content: '⭐',
  // or custom emoji: ':blobcat:'
  _misskey_reaction: '⭐',
};

const MISSKEY_ANNOUNCE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Announce',
  id: 'https://misskey.io/notes/renote123/activity',
  actor: 'https://misskey.io/users/9abc12345',
  published: '2026-03-20T17:00:00Z',
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  cc: ['https://misskey.io/users/9abc12345/followers'],
  object: 'https://hack.build/content/keyboard-guide',
};

// Misskey quote post (non-standard)
const MISSKEY_QUOTE_NOTE = {
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    {
      'misskey': 'https://misskey-hub.net/ns#',
      '_misskey_quote': 'misskey:_misskey_quote',
      'quoteUrl': 'as:quoteUrl',
    },
  ],
  type: 'Create',
  id: 'https://misskey.io/notes/quote456/activity',
  actor: 'https://misskey.io/users/9abc12345',
  object: {
    type: 'Note',
    id: 'https://misskey.io/notes/quote456',
    attributedTo: 'https://misskey.io/users/9abc12345',
    content: '<p>This is amazing! RE: <a href="https://hack.build/content/robot-arm">https://hack.build/content/robot-arm</a></p>',
    published: '2026-03-20T18:00:00Z',
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: ['https://misskey.io/users/9abc12345/followers'],
    // Misskey-specific quote reference
    '_misskey_quote': 'https://hack.build/content/robot-arm',
    'quoteUrl': 'https://hack.build/content/robot-arm',
    tag: [
      {
        type: 'Link',
        mediaType: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
        href: 'https://hack.build/content/robot-arm',
        name: 'RE: https://hack.build/content/robot-arm',
      },
    ],
  },
};

const MISSKEY_FOLLOW = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Follow',
  id: 'https://misskey.io/follows/follow789',
  actor: 'https://misskey.io/users/9abc12345',
  object: 'https://hack.build/users/bob',
};

// --- Tests ---

describe('Misskey interop: actor parsing', () => {
  it('parses Misskey Person actor with extensions', () => {
    const actor = validateActorResponse(MISSKEY_PERSON);
    expect(actor).not.toBeNull();
    expect(actor!.type).toBe('Person');
    expect(actor!.id).toBe('https://misskey.io/users/9abc12345');
    expect(actor!.preferredUsername).toBe('alice');
    expect(actor!.inbox).toBe('https://misskey.io/users/9abc12345/inbox');
    expect(actor!.endpoints?.sharedInbox).toBe('https://misskey.io/inbox');
  });

  it('gracefully ignores misskey: namespace extensions', () => {
    const actor = validateActorResponse(MISSKEY_PERSON);
    expect(actor).not.toBeNull();
    // isCat, vcard:Address etc. are silently ignored by our parser
  });

  it('handles emoji in display name', () => {
    const actor = validateActorResponse(MISSKEY_PERSON);
    expect(actor!.name).toBe('Alice 🔧');
  });
});

describe('Misskey interop: inbox processing', () => {
  it('processes Create(Note) from Misskey', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MISSKEY_CREATE_NOTE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onCreate).toHaveBeenCalledWith(
      'https://misskey.io/users/9abc12345',
      expect.objectContaining({
        type: 'Note',
        id: 'https://misskey.io/notes/9xyz',
      }),
    );
  });

  it('processes emoji reaction as Like', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MISSKEY_REACTION, cbs);

    // Misskey's emoji reactions are Like activities — our handler should treat them as likes
    expect(result.success).toBe(true);
    expect(cbs.onLike).toHaveBeenCalledWith(
      'https://misskey.io/users/9abc12345',
      'https://hack.build/content/robot-arm',
    );
  });

  it('processes Announce (renote) from Misskey', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MISSKEY_ANNOUNCE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onAnnounce).toHaveBeenCalledWith(
      'https://misskey.io/users/9abc12345',
      'https://hack.build/content/keyboard-guide',
    );
  });

  it('processes quote note as Create(Note)', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MISSKEY_QUOTE_NOTE, cbs);

    // Quote posts are just Create(Note) with extra fields — our handler treats them normally
    expect(result.success).toBe(true);
    expect(cbs.onCreate).toHaveBeenCalledWith(
      'https://misskey.io/users/9abc12345',
      expect.objectContaining({
        type: 'Note',
        id: 'https://misskey.io/notes/quote456',
      }),
    );
  });

  it('processes Follow from Misskey', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MISSKEY_FOLLOW, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onFollow).toHaveBeenCalledWith(
      'https://misskey.io/users/9abc12345',
      'https://hack.build/users/bob',
      'https://misskey.io/follows/follow789',
    );
  });
});

describe('Misskey interop: key observations', () => {
  it('uses internal ID format (not URL-based)', () => {
    // Misskey uses internal IDs like 9abc12345 in URLs
    expect(MISSKEY_PERSON.id).toContain('/users/9abc12345');
    expect(MISSKEY_CREATE_NOTE.object.id).toContain('/notes/9xyz');
  });

  it('includes _misskey_content with original MFM source', () => {
    const object = MISSKEY_CREATE_NOTE.object;
    expect(object._misskey_content).toBe('Just finished my latest project!');
    // Phase 2 could store MFM source for better re-rendering
  });

  it('includes _misskey_quote for quote posts', () => {
    const object = MISSKEY_QUOTE_NOTE.object;
    expect(object._misskey_quote).toBe('https://hack.build/content/robot-arm');
    // Phase 2 could display quotes as embedded content
  });

  it('sends emoji reactions as Like with content field', () => {
    expect(MISSKEY_REACTION.content).toBe('⭐');
    expect(MISSKEY_REACTION._misskey_reaction).toBe('⭐');
    // Phase 3 could display the specific emoji on the like
  });
});
