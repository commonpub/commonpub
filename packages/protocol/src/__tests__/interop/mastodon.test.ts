/**
 * Interop tests: verify our parsers correctly handle real Mastodon AP payloads.
 * Fixtures based on documented Mastodon ActivityPub format.
 */
import { describe, it, expect, vi } from 'vitest';
import { processInboxActivity, type InboxCallbacks } from '../../inbox';
import { validateActorResponse } from '../../actorResolver';
import { articleToContent, noteToComment } from '../../contentMapper';

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

// --- Mastodon Fixtures (based on real payloads) ---

const MASTODON_PERSON = {
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1',
    {
      'toot': 'http://joinmastodon.org/ns#',
      'discoverable': 'toot:discoverable',
      'featured': { '@id': 'toot:featured', '@type': '@id' },
    },
  ],
  type: 'Person',
  id: 'https://mastodon.social/users/alice',
  preferredUsername: 'alice',
  name: 'Alice Maker',
  summary: '<p>Hardware hacker. Building things with electrons and photons.</p>',
  inbox: 'https://mastodon.social/users/alice/inbox',
  outbox: 'https://mastodon.social/users/alice/outbox',
  followers: 'https://mastodon.social/users/alice/followers',
  following: 'https://mastodon.social/users/alice/following',
  url: 'https://mastodon.social/@alice',
  icon: {
    type: 'Image',
    url: 'https://files.mastodon.social/accounts/avatars/alice.png',
    mediaType: 'image/png',
  },
  image: {
    type: 'Image',
    url: 'https://files.mastodon.social/accounts/headers/alice_header.jpg',
    mediaType: 'image/jpeg',
  },
  publicKey: {
    id: 'https://mastodon.social/users/alice#main-key',
    owner: 'https://mastodon.social/users/alice',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----',
  },
  endpoints: {
    sharedInbox: 'https://mastodon.social/inbox',
  },
  // Mastodon-specific extensions
  'toot:discoverable': true,
  'toot:featured': 'https://mastodon.social/users/alice/collections/featured',
};

const MASTODON_CREATE_NOTE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Create',
  id: 'https://mastodon.social/users/alice/statuses/12345/activity',
  actor: 'https://mastodon.social/users/alice',
  published: '2026-03-20T10:00:00Z',
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  cc: ['https://mastodon.social/users/alice/followers'],
  object: {
    type: 'Note',
    id: 'https://mastodon.social/users/alice/statuses/12345',
    attributedTo: 'https://mastodon.social/users/alice',
    content: '<p>Just finished building a new PCB! Check it out <a href="https://hack.build/project/my-pcb" rel="nofollow noopener noreferrer" target="_blank">hack.build/project/my-pcb</a></p>',
    url: 'https://mastodon.social/@alice/12345',
    published: '2026-03-20T10:00:00Z',
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: ['https://mastodon.social/users/alice/followers'],
    tag: [
      { type: 'Hashtag', href: 'https://mastodon.social/tags/electronics', name: '#electronics' },
    ],
    attachment: [
      {
        type: 'Document',
        mediaType: 'image/jpeg',
        url: 'https://files.mastodon.social/media_attachments/pcb.jpg',
        name: 'A custom PCB layout',
      },
    ],
  },
};

const MASTODON_CREATE_ARTICLE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Create',
  id: 'https://mastodon.social/users/alice/statuses/67890/activity',
  actor: 'https://mastodon.social/users/alice',
  object: {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Article',
    id: 'https://mastodon.social/users/alice/statuses/67890',
    attributedTo: 'https://mastodon.social/users/alice',
    name: 'Getting Started with KiCad 8',
    content: '<p>A comprehensive guide to PCB design with KiCad 8...</p>',
    summary: 'Learn KiCad 8 from scratch',
    published: '2026-03-18T09:00:00Z',
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: ['https://mastodon.social/users/alice/followers'],
    tag: [
      { type: 'Hashtag', href: 'https://mastodon.social/tags/kicad', name: '#kicad' },
      { type: 'Hashtag', href: 'https://mastodon.social/tags/pcb', name: '#pcb' },
    ],
    attachment: [
      {
        type: 'Image',
        url: 'https://files.mastodon.social/media_attachments/kicad-cover.webp',
        name: 'KiCad 8 screenshot',
      },
    ],
  },
};

const MASTODON_FOLLOW = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Follow',
  id: 'https://mastodon.social/users/alice/follows/99',
  actor: 'https://mastodon.social/users/alice',
  object: 'https://hack.build/users/bob',
};

const MASTODON_ACCEPT = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Accept',
  id: 'https://mastodon.social/users/alice/accepts/99',
  actor: 'https://mastodon.social/users/alice',
  object: {
    type: 'Follow',
    id: 'https://hack.build/activities/follow-1',
    actor: 'https://hack.build/users/bob',
    object: 'https://mastodon.social/users/alice',
  },
};

const MASTODON_LIKE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Like',
  id: 'https://mastodon.social/users/alice/likes/42',
  actor: 'https://mastodon.social/users/alice',
  object: 'https://hack.build/content/robot-arm',
};

const MASTODON_ANNOUNCE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Announce',
  id: 'https://mastodon.social/users/alice/statuses/11111/activity',
  actor: 'https://mastodon.social/users/alice',
  published: '2026-03-20T11:00:00Z',
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  cc: [
    'https://hack.build/users/bob',
    'https://mastodon.social/users/alice/followers',
  ],
  object: 'https://hack.build/content/robot-arm',
};

const MASTODON_DELETE = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Delete',
  id: 'https://mastodon.social/users/alice/statuses/12345/delete',
  actor: 'https://mastodon.social/users/alice',
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  object: {
    type: 'Tombstone',
    id: 'https://mastodon.social/users/alice/statuses/12345',
    formerType: 'Note',
  },
};

const MASTODON_UNDO_FOLLOW = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Undo',
  id: 'https://mastodon.social/users/alice/undos/99',
  actor: 'https://mastodon.social/users/alice',
  object: {
    type: 'Follow',
    id: 'https://mastodon.social/users/alice/follows/99',
    actor: 'https://mastodon.social/users/alice',
    object: 'https://hack.build/users/bob',
  },
};

// --- Tests ---

describe('Mastodon interop: actor parsing', () => {
  it('parses a Mastodon Person actor with extensions', () => {
    const actor = validateActorResponse(MASTODON_PERSON);
    expect(actor).not.toBeNull();
    expect(actor!.type).toBe('Person');
    expect(actor!.id).toBe('https://mastodon.social/users/alice');
    expect(actor!.preferredUsername).toBe('alice');
    expect(actor!.name).toBe('Alice Maker');
    expect(actor!.inbox).toBe('https://mastodon.social/users/alice/inbox');
    expect(actor!.outbox).toBe('https://mastodon.social/users/alice/outbox');
    expect(actor!.publicKey?.publicKeyPem).toContain('BEGIN PUBLIC KEY');
    expect(actor!.endpoints?.sharedInbox).toBe('https://mastodon.social/inbox');
    expect(actor!.icon?.url).toContain('alice.png');
    expect(actor!.image?.url).toContain('alice_header.jpg');
  });

  it('gracefully ignores Mastodon toot: namespace extensions', () => {
    // Our parser should not reject objects with unknown extensions
    const actor = validateActorResponse(MASTODON_PERSON);
    expect(actor).not.toBeNull();
  });
});

describe('Mastodon interop: inbox processing', () => {
  it('processes Create(Note) from Mastodon', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MASTODON_CREATE_NOTE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onCreate).toHaveBeenCalledWith(
      'https://mastodon.social/users/alice',
      expect.objectContaining({
        type: 'Note',
        id: 'https://mastodon.social/users/alice/statuses/12345',
      }),
    );
  });

  it('processes Create(Article) from Mastodon', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MASTODON_CREATE_ARTICLE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onCreate).toHaveBeenCalledWith(
      'https://mastodon.social/users/alice',
      expect.objectContaining({
        type: 'Article',
        name: 'Getting Started with KiCad 8',
      }),
    );
  });

  it('processes Follow from Mastodon', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MASTODON_FOLLOW, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onFollow).toHaveBeenCalledWith(
      'https://mastodon.social/users/alice',
      'https://hack.build/users/bob',
      'https://mastodon.social/users/alice/follows/99',
    );
  });

  it('processes Accept(Follow) from Mastodon', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MASTODON_ACCEPT, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onAccept).toHaveBeenCalledWith(
      'https://mastodon.social/users/alice',
      'https://hack.build/activities/follow-1',
    );
  });

  it('processes Like from Mastodon', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MASTODON_LIKE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onLike).toHaveBeenCalledWith(
      'https://mastodon.social/users/alice',
      'https://hack.build/content/robot-arm',
    );
  });

  it('processes Announce (boost) from Mastodon', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MASTODON_ANNOUNCE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onAnnounce).toHaveBeenCalledWith(
      'https://mastodon.social/users/alice',
      'https://hack.build/content/robot-arm',
    );
  });

  it('processes Delete(Tombstone) from Mastodon', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MASTODON_DELETE, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onDelete).toHaveBeenCalledWith(
      'https://mastodon.social/users/alice',
      'https://mastodon.social/users/alice/statuses/12345',
    );
  });

  it('processes Undo(Follow) from Mastodon', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(MASTODON_UNDO_FOLLOW, cbs);

    expect(result.success).toBe(true);
    expect(cbs.onUndo).toHaveBeenCalledWith(
      'https://mastodon.social/users/alice',
      'Follow',
      'https://mastodon.social/users/alice/follows/99',
    );
  });
});

describe('Mastodon interop: content mapping', () => {
  it('parses a Mastodon Article into content fields', () => {
    const article = MASTODON_CREATE_ARTICLE.object;
    const content = articleToContent(article as Parameters<typeof articleToContent>[0]);

    expect(content.title).toBe('Getting Started with KiCad 8');
    expect(content.content).toContain('comprehensive guide');
    expect(content.description).toBe('Learn KiCad 8 from scratch');
    expect(content.coverImageUrl).toBe(
      'https://files.mastodon.social/media_attachments/kicad-cover.webp',
    );
    expect(content.publishedAt).toEqual(new Date('2026-03-18T09:00:00Z'));
  });

  it('parses a Mastodon Note into comment fields', () => {
    const note = MASTODON_CREATE_NOTE.object;
    const comment = noteToComment({
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Note' as const,
      id: note.id,
      attributedTo: note.attributedTo,
      content: note.content,
      to: note.to,
    });

    expect(comment.content).toContain('finished building a new PCB');
    expect(comment.inReplyTo).toBeUndefined();
  });
});
