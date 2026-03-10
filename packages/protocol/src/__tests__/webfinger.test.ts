import { describe, it, expect } from 'vitest';
import { parseWebFingerResource, buildWebFingerResponse } from '../webfinger';

describe('parseWebFingerResource', () => {
  it('should parse acct: URI', () => {
    const result = parseWebFingerResource('acct:alice@example.com');
    expect(result).toEqual({ username: 'alice', domain: 'example.com' });
  });

  it('should parse bare user@domain', () => {
    const result = parseWebFingerResource('alice@example.com');
    expect(result).toEqual({ username: 'alice', domain: 'example.com' });
  });

  it('should return null for missing @', () => {
    expect(parseWebFingerResource('alice')).toBeNull();
  });

  it('should return null for empty username', () => {
    expect(parseWebFingerResource('@example.com')).toBeNull();
    expect(parseWebFingerResource('acct:@example.com')).toBeNull();
  });

  it('should return null for empty domain', () => {
    expect(parseWebFingerResource('alice@')).toBeNull();
  });

  it('should return null for double @', () => {
    expect(parseWebFingerResource('alice@foo@bar')).toBeNull();
  });
});

describe('buildWebFingerResponse', () => {
  it('should produce valid JRD with self link', () => {
    const response = buildWebFingerResponse({
      username: 'alice',
      domain: 'example.com',
      actorUri: 'https://example.com/users/alice',
    });

    expect(response.subject).toBe('acct:alice@example.com');
    expect(response.links).toContainEqual({
      rel: 'self',
      type: 'application/activity+json',
      href: 'https://example.com/users/alice',
    });
  });

  it('should include profile-page link', () => {
    const response = buildWebFingerResponse({
      username: 'alice',
      domain: 'example.com',
      actorUri: 'https://example.com/users/alice',
    });

    expect(response.links).toContainEqual({
      rel: 'http://webfinger.net/rel/profile-page',
      type: 'text/html',
      href: 'https://example.com/@alice',
    });
  });

  it('should include oauth_endpoint link when provided', () => {
    const response = buildWebFingerResponse({
      username: 'alice',
      domain: 'example.com',
      actorUri: 'https://example.com/users/alice',
      oauthEndpoint: 'https://example.com/api/auth/oauth2/authorize',
    });

    expect(response.links).toContainEqual({
      rel: 'oauth_endpoint',
      href: 'https://example.com/api/auth/oauth2/authorize',
    });
  });

  it('should not include oauth_endpoint link when not provided', () => {
    const response = buildWebFingerResponse({
      username: 'alice',
      domain: 'example.com',
      actorUri: 'https://example.com/users/alice',
    });

    const oauthLink = response.links.find((l) => l.rel === 'oauth_endpoint');
    expect(oauthLink).toBeUndefined();
  });
});
