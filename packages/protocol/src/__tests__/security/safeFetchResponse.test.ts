/**
 * Federation-hardening Item 4 — `safeFetchResponse` + `safeFetchSigned`.
 *
 * `safeFetch`/`safeFetchBinary` throw on non-2xx and own redirect-following,
 * which is wrong for federation outbound:
 *  - Delivery needs the status code for circuit-breaker logic (and `202
 *    Accepted` would still throw because we'd lose access to `response.status`).
 *  - Signed AP requests MUST NOT replay to redirect targets — the HTTP
 *    Signature covers the original target, and replaying invalidates it
 *    (and is a confused-deputy risk).
 *
 * `safeFetchResponse` is the lower-level primitive that returns the response
 * shape (status + buffered body) without throwing on !ok, defaults
 * `followRedirects: false`, and applies the same SSRF + pinned-dispatcher
 * protection as the existing helpers. `safeFetchSigned` is the convenience
 * wrapper that takes a pre-signed `Request` and forwards method/headers/body.
 *
 * Tests use the same `globalThis.fetch` monkeypatch pattern as
 * `packages/server/src/__tests__/import-ssrf.test.ts`. Node's `fetch` is
 * undici; the dispatcher injection happens at the call site, so patching
 * `globalThis.fetch` is sufficient to verify the request flow without
 * touching the network.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeFetchResponse, safeFetchSigned } from '../../ssrf';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function makeResponse(opts: {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: Uint8Array;
}): Response {
  const status = opts.status ?? 200;
  const headers = new Headers(opts.headers ?? {});
  const body = opts.body ?? new Uint8Array(0);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(body); controller.close(); },
  });
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: opts.statusText ?? '',
    headers,
    body: stream,
    arrayBuffer: () => Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer),
    clone(): Response { return this as unknown as Response; },
  } as unknown as Response;
}

describe('safeFetchResponse — SSRF protection', () => {
  it('rejects literal-IP private URLs before fetch is invoked', async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    await expect(safeFetchResponse('http://127.0.0.1/x')).rejects.toThrow(/private or reserved/);
    await expect(safeFetchResponse('http://10.0.0.1/x')).rejects.toThrow(/private or reserved/);
    await expect(safeFetchResponse('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(/private or reserved/);
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects non-http(s) schemes', async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    await expect(safeFetchResponse('ftp://example.com/x')).rejects.toThrow(/private or reserved/);
    await expect(safeFetchResponse('file:///etc/passwd')).rejects.toThrow(/private or reserved/);
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects blocked hostnames (localhost, metadata)', async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    await expect(safeFetchResponse('http://localhost/x')).rejects.toThrow(/private or reserved/);
    await expect(safeFetchResponse('http://metadata.google.internal/')).rejects.toThrow(/private or reserved/);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('safeFetchResponse — non-2xx does NOT throw', () => {
  it('returns 404 with ok=false (federation delivery needs the status)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      makeResponse({ status: 404, statusText: 'Not Found', body: new TextEncoder().encode('nope') }),
    ) as unknown as typeof fetch;
    const result = await safeFetchResponse('https://example.com/inbox');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.statusText).toBe('Not Found');
    expect(result.body.toString('utf-8')).toBe('nope');
  });

  it('returns 500 without throwing (delivery treats it as a soft failure)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      makeResponse({ status: 500, statusText: 'Server Error', body: new TextEncoder().encode('') }),
    ) as unknown as typeof fetch;
    const result = await safeFetchResponse('https://example.com/inbox');
    expect(result.status).toBe(500);
    expect(result.ok).toBe(false);
  });

  it('returns 202 as ok=true (AP convention for Accepted)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      makeResponse({ status: 202, statusText: 'Accepted' }),
    ) as unknown as typeof fetch;
    const result = await safeFetchResponse('https://example.com/inbox');
    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
  });
});

describe('safeFetchResponse — request shape', () => {
  it('passes through method/headers/body for signed AP POST', async () => {
    const spy = vi.fn().mockResolvedValue(makeResponse({ status: 202 }));
    globalThis.fetch = spy as unknown as typeof fetch;
    const signedHeaders = {
      'content-type': 'application/activity+json',
      'date': 'Mon, 19 May 2026 00:00:00 GMT',
      'signature': 'keyId="https://us/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="..."',
      'digest': 'SHA-256=abc',
    };
    const body = '{"type":"Create","object":{"content":"hello"}}';
    const result = await safeFetchResponse('https://them.example/inbox', {
      method: 'POST',
      headers: signedHeaders,
      body,
    });
    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    const [, init] = spy.mock.calls[0]! as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(body);
    // Header forwarding: signed Signature header MUST be on the wire.
    const hdrs = init.headers as Record<string, string>;
    expect(hdrs['signature']).toBe(signedHeaders.signature);
    expect(hdrs['digest']).toBe(signedHeaders.digest);
    expect(hdrs['date']).toBe(signedHeaders.date);
  });

  it('defaults followRedirects: false (signed requests must not replay)', async () => {
    const spy = vi.fn().mockResolvedValue(makeResponse({
      status: 302,
      headers: { location: 'https://them.example/inbox-moved' },
    }));
    globalThis.fetch = spy as unknown as typeof fetch;
    const result = await safeFetchResponse('https://them.example/inbox', {
      method: 'POST',
      headers: { signature: 'sig' },
      body: 'payload',
    });
    expect(result.status).toBe(302);
    // Only the original target was hit; no redirect follow.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('lowercases all header keys (no duplicate `Accept` / `User-Agent` when the caller already sets them)', async () => {
    // Regression: before normalization, mixing capitalized defaults
    // (`'User-Agent'`, `'Accept'`) with lowercased caller headers
    // (`'user-agent'`, `'accept'` — the shape produced by `Headers.forEach`
    // on a signed `Request`) caused undici to emit BOTH headers, resulting
    // in a comma-joined multi-value header on the wire. Some strict
    // receivers reject that.
    const spy = vi.fn().mockResolvedValue(makeResponse({ status: 200 }));
    globalThis.fetch = spy as unknown as typeof fetch;

    await safeFetchResponse('https://them.example/inbox', {
      method: 'POST',
      headers: {
        'accept': 'application/activity+json',
        'user-agent': 'CommonPub/1.0 (+https://us)',
        'content-type': 'application/activity+json',
      },
      body: '{}',
    });

    const [, init] = spy.mock.calls[0]! as [string, RequestInit];
    const hdrs = init.headers as Record<string, string>;
    // Only the lowercased key exists; no `User-Agent` / `Accept` duplicate.
    expect('User-Agent' in hdrs).toBe(false);
    expect('Accept' in hdrs).toBe(false);
    // Caller's explicit lowercased value wins over the default.
    expect(hdrs['user-agent']).toBe('CommonPub/1.0 (+https://us)');
    expect(hdrs['accept']).toBe('application/activity+json');
  });

  it('preserves response headers (Content-Type) on the returned shape', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeResponse({
      headers: { 'content-type': 'application/activity+json; charset=utf-8' },
      body: new TextEncoder().encode('{}'),
    })) as unknown as typeof fetch;
    const result = await safeFetchResponse('https://them.example/actor');
    expect(result.contentType).toBe('application/activity+json; charset=utf-8');
  });

  it('caps body size at 10MB', async () => {
    const huge = new Uint8Array(11 * 1024 * 1024);
    globalThis.fetch = vi.fn().mockResolvedValue(makeResponse({ body: huge })) as unknown as typeof fetch;
    await expect(safeFetchResponse('https://them.example/x'))
      .rejects.toThrow(/Response too large/);
  });
});

describe('safeFetchResponse — caller-provided AbortSignal', () => {
  it('aborts when the caller\'s signal fires before the internal deadline', async () => {
    // Caller signal aborts immediately; the inner fetch must see an
    // aborted signal and reject. Proves AbortSignal.any combines correctly.
    globalThis.fetch = vi.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_, reject) => {
        const sig = init.signal as AbortSignal;
        if (sig.aborted) reject(new DOMException('Aborted', 'AbortError'));
        sig.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    }) as unknown as typeof fetch;

    const controller = new AbortController();
    controller.abort();
    await expect(safeFetchResponse('https://them.example/x', {
      signal: controller.signal,
      timeoutMs: 60_000, // deadline far away; caller signal should win
    })).rejects.toThrow();
  });

  it('uses the internal deadline when no caller signal is provided', async () => {
    // Deadline 50ms; mocked fetch hangs. Should abort via withDeadline.
    globalThis.fetch = vi.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_, reject) => {
        const sig = init.signal as AbortSignal;
        sig.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    }) as unknown as typeof fetch;

    await expect(safeFetchResponse('https://them.example/x', { timeoutMs: 50 }))
      .rejects.toThrow();
  });
});

describe('safeFetchResponse — redirect handling (followRedirects: true)', () => {
  it('re-validates redirect targets against the SSRF blocklist', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      calls.push(url);
      if (url === 'https://them.example/x') {
        return Promise.resolve(makeResponse({
          status: 302,
          headers: { location: 'http://10.0.0.1/internal' },
        }));
      }
      throw new Error('should never reach the private-IP redirect target');
    }) as unknown as typeof fetch;

    await expect(safeFetchResponse('https://them.example/x', { followRedirects: true }))
      .rejects.toThrow(/private or reserved/);
    expect(calls).toEqual(['https://them.example/x']);
  });
});

describe('safeFetchSigned', () => {
  it('forwards a signed Request through safeFetchResponse', async () => {
    const spy = vi.fn().mockResolvedValue(makeResponse({ status: 202 }));
    globalThis.fetch = spy as unknown as typeof fetch;

    const body = '{"type":"Create"}';
    const signedRequest = new Request('https://them.example/inbox', {
      method: 'POST',
      headers: {
        'content-type': 'application/activity+json',
        'signature': 'keyId="x",headers="(request-target) host date digest",signature="..."',
        'digest': 'SHA-256=xyz',
        'date': 'Mon, 19 May 2026 00:00:00 GMT',
      },
      body,
    });

    const result = await safeFetchSigned(signedRequest);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);

    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('https://them.example/inbox');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(body);
    const hdrs = init.headers as Record<string, string>;
    expect(hdrs['signature']).toContain('keyId="x"');
    expect(hdrs['digest']).toBe('SHA-256=xyz');
  });

  it('rejects a signed Request whose target is a private IP (the DNS-rebind attack class)', async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    const signedRequest = new Request('http://127.0.0.1/inbox', {
      method: 'POST',
      headers: { signature: 'sig' },
      body: 'x',
    });
    await expect(safeFetchSigned(signedRequest)).rejects.toThrow(/private or reserved/);
    expect(spy).not.toHaveBeenCalled();
  });

  it('handles a GET (signed actor fetch — no body)', async () => {
    const spy = vi.fn().mockResolvedValue(makeResponse({
      status: 200,
      headers: { 'content-type': 'application/activity+json' },
      body: new TextEncoder().encode('{"type":"Person","id":"https://them.example/users/alice","inbox":"https://them.example/users/alice/inbox","@context":"https://www.w3.org/ns/activitystreams"}'),
    }));
    globalThis.fetch = spy as unknown as typeof fetch;

    const signedRequest = new Request('https://them.example/users/alice', {
      method: 'GET',
      headers: {
        accept: 'application/activity+json',
        signature: 'keyId="x",signature="..."',
        date: 'Mon, 19 May 2026 00:00:00 GMT',
      },
    });
    const result = await safeFetchSigned(signedRequest);
    expect(result.ok).toBe(true);

    const [, init] = spy.mock.calls[0]! as [string, RequestInit];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });
});
