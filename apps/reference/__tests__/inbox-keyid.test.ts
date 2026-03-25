import { describe, it, expect } from 'vitest';

// Extracted from server/routes/inbox.ts
function extractKeyId(signatureHeader: string): string | null {
  const match = signatureHeader.match(/keyId="([^"]+)"/);
  return match ? match[1] : null;
}

describe('HTTP Signature keyId extraction', () => {
  it('extracts keyId from valid Signature header', () => {
    const header = 'keyId="https://mastodon.social/users/alice#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="..."';
    expect(extractKeyId(header)).toBe('https://mastodon.social/users/alice#main-key');
  });

  it('returns null for missing keyId', () => {
    const header = 'algorithm="rsa-sha256",headers="(request-target)"';
    expect(extractKeyId(header)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractKeyId('')).toBeNull();
  });

  it('handles keyId with special characters', () => {
    const header = 'keyId="https://example.com/users/bob%20smith#main-key"';
    expect(extractKeyId(header)).toBe('https://example.com/users/bob%20smith#main-key');
  });

  it('strips fragment from keyId to get actor URI', () => {
    const keyId = 'https://mastodon.social/users/alice#main-key';
    const actorUri = keyId.replace(/#.*$/, '');
    expect(actorUri).toBe('https://mastodon.social/users/alice');
  });

  it('handles keyId without fragment', () => {
    const keyId = 'https://gotosocial.example/users/bob';
    const actorUri = keyId.replace(/#.*$/, '');
    expect(actorUri).toBe('https://gotosocial.example/users/bob');
  });
});
