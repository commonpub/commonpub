import { describe, it, expect, vi } from 'vitest';
import {
  validateActorResponse,
  extractInbox,
  extractSharedInbox,
  resolveActor,
  resolveActorViaWebFinger,
} from '../actorResolver';

const validActor = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Person',
  id: 'https://remote.example.com/users/bob',
  preferredUsername: 'bob',
  name: 'Bob Builder',
  inbox: 'https://remote.example.com/users/bob/inbox',
  outbox: 'https://remote.example.com/users/bob/outbox',
  followers: 'https://remote.example.com/users/bob/followers',
  following: 'https://remote.example.com/users/bob/following',
  publicKey: {
    id: 'https://remote.example.com/users/bob#main-key',
    owner: 'https://remote.example.com/users/bob',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBI...\n-----END PUBLIC KEY-----',
  },
  endpoints: {
    sharedInbox: 'https://remote.example.com/inbox',
  },
};

describe('validateActorResponse', () => {
  it('should validate a complete AP actor', () => {
    const result = validateActorResponse(validActor);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('https://remote.example.com/users/bob');
    expect(result!.preferredUsername).toBe('bob');
  });

  it('should reject actor without required fields', () => {
    expect(validateActorResponse({ type: 'Person' })).toBeNull();
    expect(validateActorResponse({ id: 'not-a-url', inbox: 'also-not' })).toBeNull();
  });

  it('should accept minimal actor with only id, type, inbox', () => {
    const minimal = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Person',
      id: 'https://remote.com/users/minimal',
      inbox: 'https://remote.com/users/minimal/inbox',
    };
    const result = validateActorResponse(minimal);
    expect(result).not.toBeNull();
  });

  it('should reject invalid JSON shapes', () => {
    expect(validateActorResponse(null)).toBeNull();
    expect(validateActorResponse('string')).toBeNull();
    expect(validateActorResponse(42)).toBeNull();
  });
});

describe('extractInbox', () => {
  it('should return the inbox URL', () => {
    const actor = validateActorResponse(validActor)!;
    expect(extractInbox(actor)).toBe('https://remote.example.com/users/bob/inbox');
  });
});

describe('extractSharedInbox', () => {
  it('should return shared inbox when available', () => {
    const actor = validateActorResponse(validActor)!;
    expect(extractSharedInbox(actor)).toBe('https://remote.example.com/inbox');
  });

  it('should fall back to personal inbox when no shared inbox', () => {
    const actor = validateActorResponse({
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Person',
      id: 'https://remote.com/users/noendpoints',
      inbox: 'https://remote.com/users/noendpoints/inbox',
    })!;
    expect(extractSharedInbox(actor)).toBe('https://remote.com/users/noendpoints/inbox');
  });
});

describe('resolveActor', () => {
  it('should fetch and parse an actor by URI', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validActor),
    });

    const result = await resolveActor('https://remote.example.com/users/bob', mockFetch);

    expect(result).not.toBeNull();
    expect(result!.preferredUsername).toBe('bob');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://remote.example.com/users/bob',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/activity+json, application/ld+json',
          'User-Agent': expect.any(String),
        }),
        redirect: 'manual',
      }),
    );
  });

  it('should return null for non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Map(),
    });

    const result = await resolveActor('https://remote.com/users/nobody', mockFetch);
    expect(result).toBeNull();
  });

  it('should return null for invalid actor JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map(),
      json: () => Promise.resolve({ nonsense: true }),
    });

    const result = await resolveActor('https://remote.com/users/bad', mockFetch);
    expect(result).toBeNull();
  });
});

describe('resolveActorViaWebFinger', () => {
  it('should discover actor via WebFinger and then fetch it', async () => {
    const webFingerResponse = {
      subject: 'acct:bob@remote.example.com',
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: 'https://remote.example.com/users/bob',
        },
      ],
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(webFingerResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validActor),
      });

    const result = await resolveActorViaWebFinger('bob', 'remote.example.com', mockFetch);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('https://remote.example.com/users/bob');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://remote.example.com/.well-known/webfinger?resource=acct:bob@remote.example.com',
    );
  });

  it('should return null when WebFinger fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    const result = await resolveActorViaWebFinger('nobody', 'remote.com', mockFetch);
    expect(result).toBeNull();
  });

  it('should return null when WebFinger has no self link', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          subject: 'acct:bob@remote.com',
          links: [{ rel: 'profile', href: 'https://remote.com/@bob' }],
        }),
    });

    const result = await resolveActorViaWebFinger('bob', 'remote.com', mockFetch);
    expect(result).toBeNull();
  });
});
