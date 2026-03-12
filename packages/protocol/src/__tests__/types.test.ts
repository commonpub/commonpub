import { describe, it, expect } from 'vitest';
import type {
  WebFingerResponse,
  WebFingerLink,
  NodeInfoResponse,
  CommonPubActor,
  ParsedResource,
} from '../types';

describe('protocol types', () => {
  it('should allow constructing a valid WebFingerResponse', () => {
    const response: WebFingerResponse = {
      subject: 'acct:alice@example.com',
      links: [
        { rel: 'self', type: 'application/activity+json', href: 'https://example.com/users/alice' },
      ],
    };
    expect(response.subject).toBe('acct:alice@example.com');
    expect(response.links).toHaveLength(1);
  });

  it('should allow constructing a valid WebFingerLink', () => {
    const link: WebFingerLink = {
      rel: 'oauth_endpoint',
      href: 'https://example.com/api/auth/oauth2/authorize',
    };
    expect(link.rel).toBe('oauth_endpoint');
  });

  it('should allow constructing a valid NodeInfoResponse', () => {
    const nodeinfo: NodeInfoResponse = {
      version: '2.1',
      software: { name: 'commonpub', version: '0.0.1' },
      protocols: ['activitypub'],
      usage: { users: { total: 10, activeMonth: 5 }, localPosts: 100 },
      openRegistrations: true,
      metadata: {},
    };
    expect(nodeinfo.version).toBe('2.1');
    expect(nodeinfo.software.name).toBe('commonpub');
  });

  it('should allow constructing a valid CommonPubActor', () => {
    const actor: CommonPubActor = {
      '@context': ['https://www.w3.org/ns/activitystreams'],
      id: 'https://example.com/users/alice',
      type: 'Person',
      preferredUsername: 'alice',
      name: 'Alice',
      url: 'https://example.com/@alice',
      inbox: 'https://example.com/users/alice/inbox',
      outbox: 'https://example.com/users/alice/outbox',
      followers: 'https://example.com/users/alice/followers',
      following: 'https://example.com/users/alice/following',
    };
    expect(actor.type).toBe('Person');
    expect(actor.preferredUsername).toBe('alice');
  });

  it('should allow constructing a ParsedResource', () => {
    const parsed: ParsedResource = { username: 'alice', domain: 'example.com' };
    expect(parsed.username).toBe('alice');
    expect(parsed.domain).toBe('example.com');
  });
});
