import { describe, it, expect, vi } from 'vitest';
import { resolveActor, resolveActorViaWebFinger } from '../../actorResolver';

const VALID_ACTOR = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Person',
  id: 'https://example.com/users/alice',
  preferredUsername: 'alice',
  name: 'Alice',
  inbox: 'https://example.com/users/alice/inbox',
  outbox: 'https://example.com/users/alice/outbox',
  publicKey: {
    id: 'https://example.com/users/alice#main-key',
    owner: 'https://example.com/users/alice',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
  },
};

function mockFetch(responseBody: unknown = VALID_ACTOR, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/activity+json' },
    }),
  );
}

describe('SSRF protection in resolveActor', () => {
  // --- Private IP ranges ---

  it('rejects 127.0.0.1 (loopback)', async () => {
    const fetch = mockFetch();
    const result = await resolveActor('https://127.0.0.1/users/alice', fetch);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects 127.x.x.x variants', async () => {
    const fetch = mockFetch();
    const result = await resolveActor('https://127.0.0.2/users/alice', fetch);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects 10.x.x.x (RFC 1918 Class A)', async () => {
    const fetch = mockFetch();
    const result = await resolveActor('https://10.0.0.1/users/alice', fetch);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects 172.16-31.x.x (RFC 1918 Class B)', async () => {
    const fetch = mockFetch();
    expect(await resolveActor('https://172.16.0.1/users/alice', fetch)).toBeNull();
    expect(await resolveActor('https://172.20.0.1/users/alice', fetch)).toBeNull();
    expect(await resolveActor('https://172.31.255.255/users/alice', fetch)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows 172.15.x.x (not private)', async () => {
    const fetch = mockFetch();
    await resolveActor('https://172.15.0.1/users/alice', fetch);
    expect(fetch).toHaveBeenCalled();
  });

  it('allows 172.32.x.x (not private)', async () => {
    const fetch = mockFetch();
    await resolveActor('https://172.32.0.1/users/alice', fetch);
    expect(fetch).toHaveBeenCalled();
  });

  it('rejects 192.168.x.x (RFC 1918 Class C)', async () => {
    const fetch = mockFetch();
    const result = await resolveActor('https://192.168.1.1/users/alice', fetch);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects 169.254.x.x (link-local / cloud metadata)', async () => {
    const fetch = mockFetch();
    const result = await resolveActor('https://169.254.169.254/latest/meta-data/', fetch);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  // --- Blocked hostnames ---

  it('rejects localhost', async () => {
    const fetch = mockFetch();
    const result = await resolveActor('https://localhost/users/alice', fetch);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects localhost.localdomain', async () => {
    const fetch = mockFetch();
    const result = await resolveActor('https://localhost.localdomain/users/alice', fetch);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects GCP metadata endpoint', async () => {
    const fetch = mockFetch();
    const result = await resolveActor('https://metadata.google.internal/computeMetadata/', fetch);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  // --- Additional private ranges ---

  it('rejects 0.x.x.x (current network)', async () => {
    const fetch = mockFetch();
    expect(await resolveActor('https://0.0.0.1/users/alice', fetch)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects CGN shared address space 100.64-127.x.x', async () => {
    const fetch = mockFetch();
    expect(await resolveActor('https://100.64.0.1/users/alice', fetch)).toBeNull();
    expect(await resolveActor('https://100.100.0.1/users/alice', fetch)).toBeNull();
    expect(await resolveActor('https://100.127.255.255/users/alice', fetch)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows 100.128.x.x (outside CGN)', async () => {
    const fetch = mockFetch();
    await resolveActor('https://100.128.0.1/users/alice', fetch);
    expect(fetch).toHaveBeenCalled();
  });

  it('rejects 198.18-19.x.x (benchmarking)', async () => {
    const fetch = mockFetch();
    expect(await resolveActor('https://198.18.0.1/users/alice', fetch)).toBeNull();
    expect(await resolveActor('https://198.19.255.255/users/alice', fetch)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows 198.20.x.x (outside benchmarking)', async () => {
    const fetch = mockFetch();
    await resolveActor('https://198.20.0.1/users/alice', fetch);
    expect(fetch).toHaveBeenCalled();
  });

  it('rejects 192.0.0.x (IETF protocol assignments)', async () => {
    const fetch = mockFetch();
    expect(await resolveActor('https://192.0.0.1/users/alice', fetch)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects TEST-NET ranges (192.0.2, 198.51.100, 203.0.113)', async () => {
    const fetch = mockFetch();
    expect(await resolveActor('https://192.0.2.1/users/alice', fetch)).toBeNull();
    expect(await resolveActor('https://198.51.100.1/users/alice', fetch)).toBeNull();
    expect(await resolveActor('https://203.0.113.1/users/alice', fetch)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  // Note: IPv6 SSRF protection is limited because Node's URL parser
  // returns hostname with brackets (e.g., "[::1]") which doesn't match
  // the current regex patterns. This is a known limitation.
  // TODO: Fix IPv6 SSRF patterns to handle bracketed hostnames.

  it('allows 11.x.x.x (outside RFC 1918)', async () => {
    const fetch = mockFetch();
    await resolveActor('https://11.0.0.1/users/alice', fetch);
    expect(fetch).toHaveBeenCalled();
  });

  it('allows 128.x.x.x (outside loopback)', async () => {
    const fetch = mockFetch();
    await resolveActor('https://128.0.0.1/users/alice', fetch);
    expect(fetch).toHaveBeenCalled();
  });

  it('allows 192.169.x.x (outside RFC 1918 Class C)', async () => {
    const fetch = mockFetch();
    await resolveActor('https://192.169.0.1/users/alice', fetch);
    expect(fetch).toHaveBeenCalled();
  });

  it('allows 170.x.x.x (outside link-local)', async () => {
    const fetch = mockFetch();
    await resolveActor('https://170.0.0.1/users/alice', fetch);
    expect(fetch).toHaveBeenCalled();
  });

  // --- Protocol restrictions ---

  it('rejects non-HTTP(S) protocols', async () => {
    const fetch = mockFetch();
    expect(await resolveActor('ftp://example.com/users/alice', fetch)).toBeNull();
    expect(await resolveActor('file:///etc/passwd', fetch)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects malformed URLs', async () => {
    const fetch = mockFetch();
    expect(await resolveActor('not-a-url', fetch)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  // --- Allows legitimate ---

  it('allows public IP addresses', async () => {
    const fetch = mockFetch();
    await resolveActor('https://93.184.216.34/users/alice', fetch);
    expect(fetch).toHaveBeenCalled();
  });

  it('allows valid domain names', async () => {
    const fetch = mockFetch();
    await resolveActor('https://mastodon.social/users/alice', fetch);
    expect(fetch).toHaveBeenCalled();
  });

  it('allows HTTP in development', async () => {
    const fetch = mockFetch();
    await resolveActor('http://example.com/users/alice', fetch);
    expect(fetch).toHaveBeenCalled();
  });
});

describe('SSRF protection in resolveActorViaWebFinger', () => {
  it('rejects WebFinger to private domains', async () => {
    const fetch = mockFetch();
    const result = await resolveActorViaWebFinger('alice', 'localhost', fetch);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects WebFinger to private IPs', async () => {
    const fetch = mockFetch();
    const result = await resolveActorViaWebFinger('alice', '10.0.0.1', fetch);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects WebFinger to metadata endpoints', async () => {
    const fetch = mockFetch();
    const result = await resolveActorViaWebFinger('alice', '169.254.169.254', fetch);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
