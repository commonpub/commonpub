/**
 * `FetchFn`-compatible wrapper around `safeFetchResponse` for use with
 * `resolveActor` / `resolveActorViaWebFinger`. Those helpers were defined
 * before the pinned-dispatcher work — they own a per-hop string-level
 * `isPrivateUrl` check but rely on the injected fetch fn for the
 * DNS-rebind defence. Passing raw `globalThis.fetch` skips the pinned
 * dispatcher, so callers in `@commonpub/server/federation` must route
 * through this wrapper instead.
 *
 * Federation-hardening Item 4 (session 150). Sessions 148/149 plugged
 * unsigned remote-GETs at the server perimeter; this closes the
 * actor-resolution path that runs underneath those + the federation
 * router (`federation.ts:163`, `messaging.ts:59`, etc).
 */
import { safeFetchResponse, type SafeFetchResponseResult } from '@commonpub/protocol';

const ACTOR_RESOLVE_TIMEOUT_MS = 30_000;

/**
 * Build a `FetchFn` shape `(url, init?) => Promise<Response>` that proxies
 * to `safeFetchResponse`. Body buffering is the trade-off: actor JSON
 * payloads are tiny (< 4KB typical, < 10MB cap), so the cost is negligible.
 * Headers are preserved (incl. Location, so `resolveActor`'s manual
 * redirect loop still works).
 */
export function createSafeActorFetchFn(): (url: string, init?: RequestInit) => Promise<Response> {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const headerObj: Record<string, string> = {};
    if (init?.headers) {
      const h = new Headers(init.headers as HeadersInit);
      h.forEach((value, key) => { headerObj[key] = value; });
    }
    const result: SafeFetchResponseResult = await safeFetchResponse(url, {
      method: init?.method ?? 'GET',
      headers: headerObj,
      ...(typeof init?.body === 'string' ? { body: init.body } : {}),
      followRedirects: false,
      timeoutMs: ACTOR_RESOLVE_TIMEOUT_MS,
      // Forward the caller's signal so `resolveActor`'s per-call
      // AbortController + timeout work end-to-end. safeFetchResponse
      // combines this with its internal deadline via AbortSignal.any —
      // whichever fires first aborts the underlying fetch.
      ...(init?.signal ? { signal: init.signal } : {}),
    });
    // Reconstruct a Response object so the caller's `.json()`/`.ok`/
    // `.headers.get('location')` calls keep working unchanged. Slice into
    // an ArrayBuffer (a valid BodyInit) to avoid the WHATWG-Buffer typing
    // mismatch — the runtime accepts a Node Buffer here, but `BodyInit`
    // does not include it in the typescript-dom definition.
    const ab = result.body.buffer.slice(
      result.body.byteOffset,
      result.body.byteOffset + result.body.byteLength,
    ) as ArrayBuffer;
    return new Response(ab, {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
    });
  };
}
