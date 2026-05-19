import { z } from 'zod';
import { isPrivateUrl } from './ssrf.js';

// SSRF protection is consolidated in ./ssrf (federation-hardening Item 5).
// `resolveActor`/`resolveActorViaWebFinger` keep their per-hop
// `isPrivateUrl` string check; callers that want DNS-rebind protection
// inject a `fetchFn` backed by `safeFetch`'s pinned dispatcher.

/** Minimal AP actor shape for validation */
const apActorSchema = z.object({
  '@context': z.union([z.string(), z.array(z.unknown())]),
  type: z.string(),
  id: z.string().url(),
  preferredUsername: z.string().optional(),
  name: z.string().optional(),
  summary: z.string().optional(),
  inbox: z.string().url(),
  outbox: z.string().url().optional(),
  followers: z.string().url().optional(),
  following: z.string().url().optional(),
  url: z.string().optional(),
  icon: z
    .union([
      z.object({
        type: z.string(),
        url: z.string().url(),
        mediaType: z.string().optional(),
      }),
      z.array(z.object({
        type: z.string(),
        url: z.string().url(),
        mediaType: z.string().optional(),
      })).transform((arr) => arr[0]),
    ])
    .optional(),
  image: z
    .union([
      z.object({
        type: z.string(),
        url: z.string().url(),
        mediaType: z.string().optional(),
      }),
      z.array(z.object({
        type: z.string(),
        url: z.string().url(),
        mediaType: z.string().optional(),
      })).transform((arr) => arr[0]),
    ])
    .optional(),
  publicKey: z
    .object({
      id: z.string(),
      owner: z.string(),
      publicKeyPem: z.string(),
    })
    .optional(),
  endpoints: z
    .object({
      sharedInbox: z.string().url().optional(),
    })
    .optional(),
});

export type ResolvedActor = z.infer<typeof apActorSchema>;

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** Validate raw JSON as an AP actor */
export function validateActorResponse(json: unknown): ResolvedActor | null {
  const result = apActorSchema.safeParse(json);
  return result.success ? result.data : null;
}

/** Extract inbox URL from an actor object */
export function extractInbox(actor: ResolvedActor): string {
  return actor.inbox;
}

/** Extract shared inbox URL if available, falling back to personal inbox */
export function extractSharedInbox(actor: ResolvedActor): string {
  return actor.endpoints?.sharedInbox ?? actor.inbox;
}

/** Maximum redirects to follow when resolving actors */
const MAX_REDIRECTS = 3;

/** Fetch timeout for actor resolution (30 seconds) */
const RESOLVE_TIMEOUT_MS = 30_000;

/** Fetch and parse an AP actor by URI */
export async function resolveActor(
  actorUri: string,
  fetchFn: FetchFn,
): Promise<ResolvedActor | null> {
  // SSRF protection: block requests to private/internal networks
  if (isPrivateUrl(actorUri)) {
    return null;
  }

  // Follow redirects manually to enforce limit and validate each hop
  let currentUri = actorUri;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (isPrivateUrl(currentUri)) return null; // Check each redirect hop

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
    try {
      const response = await fetchFn(currentUri, {
        headers: {
          Accept: 'application/activity+json, application/ld+json',
          'User-Agent': 'CommonPub/1.0 (ActivityPub)',
        },
        redirect: 'manual',
        signal: controller.signal,
      });

      // Handle redirects manually
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || i === MAX_REDIRECTS) return null;
        currentUri = new URL(location, currentUri).toString();
        continue;
      }

      if (!response.ok) return null;

      const json = await response.json();
      return validateActorResponse(json);
    } catch {
      return null; // Network error, timeout, abort
    } finally {
      clearTimeout(timeout);
    }
  }

  return null; // Exceeded max redirects
}

/** Resolve an actor via WebFinger discovery: username@domain → actor URI → actor JSON */
export async function resolveActorViaWebFinger(
  username: string,
  domain: string,
  fetchFn: FetchFn,
): Promise<ResolvedActor | null> {
  const webFingerUrl = `https://${domain}/.well-known/webfinger?resource=acct:${username}@${domain}`;

  // SSRF protection
  if (isPrivateUrl(webFingerUrl)) return null;

  // The abort timeout must span the body read too — clearing it before
  // `wfResponse.json()` (as the old code did) left the JSON parse of a
  // slow-trickle upstream with no deadline.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
  let wfJson: { links?: Array<{ rel: string; type?: string; href?: string }> };
  try {
    const wfResponse = await fetchFn(webFingerUrl, {
      headers: { Accept: 'application/jrd+json', 'User-Agent': 'CommonPub/1.0 (ActivityPub)' },
      signal: controller.signal,
    });
    if (!wfResponse.ok) return null;
    wfJson = await wfResponse.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }

  const selfLink = wfJson?.links?.find(
    (link) => link.rel === 'self' && link.type === 'application/activity+json',
  );

  if (!selfLink?.href) return null;

  // resolveActor already has SSRF protection + its own timeout
  return resolveActor(selfLink.href, fetchFn);
}
