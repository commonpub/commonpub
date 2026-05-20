/**
 * SSRF protection — re-export shim.
 *
 * The canonical implementation moved to `@commonpub/protocol` in the
 * federation-hardening work (Item 5) so `actorResolver` and the server
 * share one module (and one pinned-lookup dispatcher). This shim keeps
 * every internal `~/import/ssrf` import site and `@commonpub/server`'s
 * public API (stable since 2.48.0) unchanged. Do not add logic here —
 * edit `packages/protocol/src/ssrf.ts`.
 */
export { isPrivateIp, isPrivateUrl, safeFetch, safeFetchBinary, safeFetchResponse, safeFetchSigned } from '@commonpub/protocol';
export type { SafeFetchOptions, SafeFetchResponseResult } from '@commonpub/protocol';
