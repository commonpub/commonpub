import { z } from 'zod';
import { parseWebFingerResource } from './webfinger.js';

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
  /^::1$/,                            // IPv6 loopback
  /^fc/i,                             // IPv6 unique local
  /^fd/i,                             // IPv6 unique local
  /^fe80/i,                           // IPv6 link-local
];

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

  if (BLOCKED_HOSTNAMES.has(hostname)) return true;

  // Check IP patterns (if hostname is an IP address)
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) return true;
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
    .object({
      type: z.string(),
      url: z.string().url(),
      mediaType: z.string().optional(),
    })
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

/** Fetch and parse an AP actor by URI */
export async function resolveActor(
  actorUri: string,
  fetchFn: FetchFn,
): Promise<ResolvedActor | null> {
  // SSRF protection: block requests to private/internal networks
  if (isPrivateUrl(actorUri)) {
    return null;
  }

  const response = await fetchFn(actorUri, {
    headers: {
      Accept: 'application/activity+json, application/ld+json',
    },
  });

  if (!response.ok) return null;

  const json = await response.json();
  return validateActorResponse(json);
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

  const wfResponse = await fetchFn(webFingerUrl, {
    headers: { Accept: 'application/jrd+json' },
  });

  if (!wfResponse.ok) return null;

  const wfJson = await wfResponse.json();
  const selfLink = wfJson?.links?.find(
    (link: { rel: string; type?: string }) =>
      link.rel === 'self' && link.type === 'application/activity+json',
  );

  if (!selfLink?.href) return null;

  // resolveActor already has SSRF protection
  return resolveActor(selfLink.href, fetchFn);
}
