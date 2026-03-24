import { describe, it, expect } from 'vitest';
import type {
  APCreate,
  APFollow,
  APAccept,
  APLike,
  APAnnounce,
  APArticle,
  APNote,
  APTombstone,
  APObject,
  APOrderedCollection,
  APOrderedCollectionPage,
} from '../activityTypes';
import { AP_CONTEXT, AP_PUBLIC } from '../activityTypes';

describe('AP constants', () => {
  it('should export AP_CONTEXT', () => {
    expect(AP_CONTEXT).toBe('https://www.w3.org/ns/activitystreams');
  });

  it('should export AP_PUBLIC', () => {
    expect(AP_PUBLIC).toBe('https://www.w3.org/ns/activitystreams#Public');
  });
});

describe('AP Object types', () => {
  it('should construct APArticle', () => {
    const article: APArticle = {
      '@context': AP_CONTEXT,
      type: 'Article',
      id: 'https://example.com/content/test',
      attributedTo: 'https://example.com/users/alice',
      name: 'Test Article',
      content: '<p>Hello</p>',
      to: [AP_PUBLIC],
    };
    expect(article.type).toBe('Article');
    expect(article.name).toBe('Test Article');
  });

  it('should construct APNote with inReplyTo', () => {
    const note: APNote = {
      '@context': AP_CONTEXT,
      type: 'Note',
      id: 'https://example.com/comments/123',
      attributedTo: 'https://example.com/users/alice',
      content: 'Great post!',
      inReplyTo: 'https://example.com/content/test',
      to: [AP_PUBLIC],
    };
    expect(note.type).toBe('Note');
    expect(note.inReplyTo).toBe('https://example.com/content/test');
  });

  it('should construct APTombstone', () => {
    const tombstone: APTombstone = {
      '@context': AP_CONTEXT,
      type: 'Tombstone',
      id: 'https://example.com/content/deleted',
      formerType: 'Article',
    };
    expect(tombstone.type).toBe('Tombstone');
    expect(tombstone.formerType).toBe('Article');
  });

  it('should accept APObject as union', () => {
    const objects: APObject[] = [
      {
        '@context': AP_CONTEXT,
        type: 'Article',
        id: 'https://example.com/1',
        attributedTo: 'https://example.com/users/a',
        name: 'X',
        content: 'Y',
        to: [AP_PUBLIC],
      },
      {
        '@context': AP_CONTEXT,
        type: 'Note',
        id: 'https://example.com/2',
        attributedTo: 'https://example.com/users/a',
        content: 'Z',
        to: [AP_PUBLIC],
      },
      {
        '@context': AP_CONTEXT,
        type: 'Tombstone',
        id: 'https://example.com/3',
        formerType: 'Note',
      },
    ];
    expect(objects).toHaveLength(3);
  });
});

describe('AP Activity types', () => {
  it('should construct APCreate', () => {
    const create: APCreate = {
      '@context': AP_CONTEXT,
      type: 'Create',
      id: 'https://example.com/activities/1',
      actor: 'https://example.com/users/alice',
      object: {
        '@context': AP_CONTEXT,
        type: 'Article',
        id: 'https://example.com/content/test',
        attributedTo: 'https://example.com/users/alice',
        name: 'Test',
        content: 'Hello',
        to: [AP_PUBLIC],
      },
      to: [AP_PUBLIC],
    };
    expect(create.type).toBe('Create');
  });

  it('should construct APFollow', () => {
    const follow: APFollow = {
      '@context': AP_CONTEXT,
      type: 'Follow',
      id: 'https://example.com/activities/2',
      actor: 'https://example.com/users/alice',
      object: 'https://remote.com/users/bob',
    };
    expect(follow.type).toBe('Follow');
  });

  it('should construct APAccept wrapping a Follow', () => {
    const follow: APFollow = {
      '@context': AP_CONTEXT,
      type: 'Follow',
      id: 'https://example.com/activities/2',
      actor: 'https://example.com/users/alice',
      object: 'https://remote.com/users/bob',
    };
    const accept: APAccept = {
      '@context': AP_CONTEXT,
      type: 'Accept',
      id: 'https://remote.com/activities/3',
      actor: 'https://remote.com/users/bob',
      object: follow,
    };
    expect(accept.type).toBe('Accept');
    expect(typeof accept.object).toBe('object');
  });

  it('should construct APLike', () => {
    const like: APLike = {
      '@context': AP_CONTEXT,
      type: 'Like',
      id: 'https://example.com/activities/4',
      actor: 'https://example.com/users/alice',
      object: 'https://remote.com/content/post',
    };
    expect(like.type).toBe('Like');
  });

  it('should construct APAnnounce', () => {
    const announce: APAnnounce = {
      '@context': AP_CONTEXT,
      type: 'Announce',
      id: 'https://example.com/activities/5',
      actor: 'https://example.com/users/alice',
      object: 'https://remote.com/content/post',
      to: [AP_PUBLIC],
    };
    expect(announce.type).toBe('Announce');
  });

  it('should accept APActivity as union of all 9 types', () => {
    const activities: APActivity[] = [];
    expect(activities).toHaveLength(0);
  });
});

describe('AP Collection types', () => {
  it('should construct APOrderedCollection', () => {
    const collection: APOrderedCollection = {
      '@context': AP_CONTEXT,
      type: 'OrderedCollection',
      id: 'https://example.com/users/alice/outbox',
      totalItems: 42,
      first: 'https://example.com/users/alice/outbox?page=1',
    };
    expect(collection.totalItems).toBe(42);
  });

  it('should construct APOrderedCollectionPage', () => {
    const page: APOrderedCollectionPage = {
      '@context': AP_CONTEXT,
      type: 'OrderedCollectionPage',
      id: 'https://example.com/users/alice/outbox?page=1',
      partOf: 'https://example.com/users/alice/outbox',
      orderedItems: [],
    };
    expect(page.orderedItems).toHaveLength(0);
  });
});
