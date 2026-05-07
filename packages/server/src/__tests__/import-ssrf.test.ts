import { describe, it, expect, vi, afterEach } from 'vitest';
import { isPrivateUrl, safeFetch, safeFetchBinary } from '../import/ssrf';

describe('import SSRF protection', () => {
  describe('isPrivateUrl', () => {
    it('should block localhost', () => {
      expect(isPrivateUrl('http://localhost/page')).toBe(true);
      expect(isPrivateUrl('http://localhost:3000/page')).toBe(true);
      expect(isPrivateUrl('https://localhost.localdomain/page')).toBe(true);
    });

    it('should block 127.x.x.x loopback', () => {
      expect(isPrivateUrl('http://127.0.0.1/page')).toBe(true);
      expect(isPrivateUrl('http://127.0.0.2/page')).toBe(true);
      expect(isPrivateUrl('http://127.255.255.255/page')).toBe(true);
    });

    it('should block RFC 1918 Class A (10.x)', () => {
      expect(isPrivateUrl('http://10.0.0.1/page')).toBe(true);
      expect(isPrivateUrl('http://10.255.255.255/page')).toBe(true);
    });

    it('should block RFC 1918 Class B (172.16-31.x)', () => {
      expect(isPrivateUrl('http://172.16.0.1/page')).toBe(true);
      expect(isPrivateUrl('http://172.31.255.255/page')).toBe(true);
    });

    it('should allow non-private 172.x addresses', () => {
      expect(isPrivateUrl('http://172.15.0.1/page')).toBe(false);
      expect(isPrivateUrl('http://172.32.0.1/page')).toBe(false);
    });

    it('should block RFC 1918 Class C (192.168.x)', () => {
      expect(isPrivateUrl('http://192.168.0.1/page')).toBe(true);
      expect(isPrivateUrl('http://192.168.255.255/page')).toBe(true);
    });

    it('should block link-local (169.254.x)', () => {
      expect(isPrivateUrl('http://169.254.0.1/page')).toBe(true);
    });

    it('should block current network (0.x)', () => {
      expect(isPrivateUrl('http://0.0.0.0/page')).toBe(true);
    });

    it('should block CGN shared address space (100.64-127.x)', () => {
      expect(isPrivateUrl('http://100.64.0.1/page')).toBe(true);
      expect(isPrivateUrl('http://100.127.255.255/page')).toBe(true);
    });

    it('should allow non-CGN 100.x addresses', () => {
      expect(isPrivateUrl('http://100.128.0.1/page')).toBe(false);
    });

    it('should block benchmarking (198.18-19.x)', () => {
      expect(isPrivateUrl('http://198.18.0.1/page')).toBe(true);
      expect(isPrivateUrl('http://198.19.255.255/page')).toBe(true);
    });

    it('should block TEST-NET ranges', () => {
      expect(isPrivateUrl('http://192.0.2.1/page')).toBe(true);
      expect(isPrivateUrl('http://198.51.100.1/page')).toBe(true);
      expect(isPrivateUrl('http://203.0.113.1/page')).toBe(true);
    });

    it('should block cloud metadata endpoints', () => {
      expect(isPrivateUrl('http://metadata.google.internal/page')).toBe(true);
      expect(isPrivateUrl('http://metadata.internal/page')).toBe(true);
    });

    it('should block IPv6 loopback', () => {
      expect(isPrivateUrl('http://[::1]/page')).toBe(true);
    });

    it('should block IPv6 unique local', () => {
      expect(isPrivateUrl('http://[fc00::1]/page')).toBe(true);
      expect(isPrivateUrl('http://[fd12::1]/page')).toBe(true);
    });

    it('should block IPv6 link-local', () => {
      expect(isPrivateUrl('http://[fe80::1]/page')).toBe(true);
    });

    it('should block non-HTTP protocols', () => {
      expect(isPrivateUrl('ftp://example.com/file')).toBe(true);
      expect(isPrivateUrl('file:///etc/passwd')).toBe(true);
      expect(isPrivateUrl('javascript:alert(1)')).toBe(true);
    });

    it('should block malformed URLs', () => {
      expect(isPrivateUrl('not-a-url')).toBe(true);
      expect(isPrivateUrl('')).toBe(true);
    });

    it('should allow public URLs', () => {
      expect(isPrivateUrl('https://example.com/page')).toBe(false);
      expect(isPrivateUrl('https://www.hackster.io/project')).toBe(false);
      expect(isPrivateUrl('https://medium.com/@user/article')).toBe(false);
      expect(isPrivateUrl('http://dev.to/user/post')).toBe(false);
    });
  });

  describe('safeFetchBinary — redirect re-validation', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => { globalThis.fetch = originalFetch; });

    /**
     * Build a Response-shaped mock. When `body` is provided, it's a
     * ReadableStream that emits the buffer in one chunk — exercises the
     * streaming size-cap path. When omitted, callers fall back to the
     * arrayBuffer() path.
     */
    function makeResponse(opts: {
      status?: number;
      headers?: Record<string, string>;
      body?: Uint8Array;
      withStream?: boolean;
    }): Response {
      const status = opts.status ?? 200;
      const headers = new Headers(opts.headers ?? {});
      const body = opts.body ?? new Uint8Array(0);
      const stream = opts.withStream
        ? new ReadableStream<Uint8Array>({
            start(controller) { controller.enqueue(body); controller.close(); },
          })
        : null;
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: 'OK',
        headers,
        body: stream,
        arrayBuffer: () => Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer),
        clone(): Response { return this as unknown as Response; },
      } as unknown as Response;
    }

    it('rejects an initial private URL', async () => {
      await expect(safeFetchBinary('http://10.0.0.1/x.png'))
        .rejects.toThrow(/private or reserved/);
    });

    it('rejects a non-HTTP scheme', async () => {
      await expect(safeFetchBinary('ftp://example.com/x'))
        .rejects.toThrow(/private or reserved/);
    });

    it('re-validates redirect targets against the SSRF blocklist', async () => {
      // Initial URL passes the public-host check; redirect target points at
      // a private IP. safeFetchBinary must catch the redirect target, NOT
      // follow it blindly the way `fetch(..., { redirect: 'follow' })` would.
      const calls: string[] = [];
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        calls.push(url);
        if (url === 'https://evil.com/img.png') {
          return Promise.resolve(makeResponse({
            status: 302,
            headers: { location: 'http://10.0.0.1/internal' },
          }));
        }
        throw new Error('should never reach the private-IP redirect target');
      }) as unknown as typeof fetch;

      await expect(safeFetchBinary('https://evil.com/img.png'))
        .rejects.toThrow(/private or reserved/);
      // Only the initial URL got fetched; the redirect target was rejected.
      expect(calls).toEqual(['https://evil.com/img.png']);
    });

    it('caps the body size when streaming', async () => {
      // 11 MB > 10 MB cap. Streamed via ReadableStream so the cap-check
      // fires mid-read instead of after a full buffer.
      const huge = new Uint8Array(11 * 1024 * 1024);
      globalThis.fetch = vi.fn().mockResolvedValue(makeResponse({
        headers: { 'content-type': 'image/png' },
        body: huge,
        withStream: true,
      })) as unknown as typeof fetch;

      await expect(safeFetchBinary('https://example.com/huge.png'))
        .rejects.toThrow(/Response too large/);
    });

    it('returns the upstream Content-Type', async () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      globalThis.fetch = vi.fn().mockResolvedValue(makeResponse({
        headers: { 'content-type': 'image/png' },
        body: png,
        withStream: true,
      })) as unknown as typeof fetch;

      const { buffer, contentType, finalUrl } = await safeFetchBinary('https://example.com/x.png');
      expect(contentType).toBe('image/png');
      expect(buffer.byteLength).toBe(png.byteLength);
      expect(finalUrl).toBe('https://example.com/x.png');
    });

    it('caps redirect chain length', async () => {
      // Each redirect points at the next hop on a public host. After 5
      // redirects safeFetchBinary should give up.
      let hop = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        hop++;
        return Promise.resolve(makeResponse({
          status: 302,
          headers: { location: `https://example${hop}.com/next` },
        }));
      }) as unknown as typeof fetch;

      await expect(safeFetchBinary('https://example0.com/start'))
        .rejects.toThrow(/Too many redirects/);
    });
  });

  describe('safeFetch — streaming size cap shared with safeFetchBinary', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => { globalThis.fetch = originalFetch; });

    it('rejects oversized streamed response', async () => {
      const huge = new Uint8Array(11 * 1024 * 1024);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: new ReadableStream<Uint8Array>({
          start(c) { c.enqueue(huge); c.close(); },
        }),
        arrayBuffer: () => Promise.resolve(huge.buffer.slice(0) as ArrayBuffer),
        clone() { return this as unknown as Response; },
      }) as unknown as typeof fetch;

      await expect(safeFetch('https://example.com/huge.html'))
        .rejects.toThrow(/Response too large/);
    });
  });
});
