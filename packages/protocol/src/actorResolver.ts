import { z } from 'zod';
import { parseWebFingerResource } from './webfinger.js';

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

  return resolveActor(selfLink.href, fetchFn);
}
