import { z } from 'zod';

// --- SSRF Protection ---

/** Reserved/private IP ranges that must never be fetched */
const PRIVATE_IP_PATTERNS = [
  /^127\./,                           // Loopback
  /^10\./,                            // RFC 1918 Class A
  /^172\.(1[6-9]|2\d|3[01])\./,      // RFC 1918 Class B
  /^192\.168\./,                      // RFC 1918 Class C
  /^169\.254\./,                      // Link-local
  /^0\./,                             // Current network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Shared address space (CGN)
  /^198\.1[89]\./,                    // Benchmarking
  /^192\.0\.0\./,                     // IETF Protocol assignments
  /^192\.0\.2\./,                     // TEST-NET-1
  /^198\.51\.100\./,                  // TEST-NET-2
  /^203\.0\.113\./,                   // TEST-NET-3
  /^22[4-9]\./,                       // 224.0.0.0+ multicast / reserved
  /^23\d\./,
  /^24\d\./,
  /^25[0-5]\./,
  /^::1$/,                            // IPv6 loopback
  /^::$/,                             // IPv6 unspecified
  /^::ffff:/i,                        // IPv4-mapped IPv6 (handled below too)
  /^fc/i,                             // IPv6 unique local
  /^fd/i,                             // IPv6 unique local
  /^fe[89ab]/i,                       // IPv6 link-local fe80::/10
  /^ff/i,                             // IPv6 multicast
];

/**
 * Numeric-host SSRF encodings `new URL()` accepts but no public host uses:
 * dotless decimal (2130706433), hex (0x7f000001), octal-leading segments.
 */
function isSuspiciousNumericHost(host: string): boolean {
  if (/^\d+$/.test(host)) return true;
  if (/^0x[0-9a-f]+$/i.test(host)) return true;
  if (/^0\d+(\.\d+){0,3}$/.test(host)) return true;
  if (/^0x[0-9a-f]+(\.[0-9a-fx]+){0,3}$/i.test(host)) return true;
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',       // GCP metadata
  'metadata.internal',
]);

/** Check if a URL points to a private/internal resource */
function isPrivateUrl(urlString: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return true; // Malformed URLs are blocked
  }

  // Must be HTTPS for production ActivityPub
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase();
  // Strip IPv6 brackets for regex matching (Node URL parser keeps them: [::1])
  const hostnameForCheck = hostname.replace(/^\[|\]$/g, '');

  if (!hostnameForCheck) return true;
  if (BLOCKED_HOSTNAMES.has(hostnameForCheck)) return true;
  if (isSuspiciousNumericHost(hostnameForCheck)) return true;

  // Check IP patterns (if hostname is an IP address)
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostnameForCheck)) return true;
  }

  return false;
}

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
