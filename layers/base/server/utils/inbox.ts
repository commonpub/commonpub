/**
 * Shared inbox verification utilities.
 * Handles HTTP Signature verification, actor domain validation,
 * body size limits, and Date header freshness checks.
 */
import { verifyHttpSignature, resolveActor } from '@commonpub/protocol';
import type { H3Event } from 'h3';

/** Maximum allowed body size for inbox POSTs (1 MB) */
const MAX_BODY_SIZE = 1_048_576;

/** Maximum allowed clock skew for Date header (5 minutes) */
const MAX_DATE_SKEW_MS = 5 * 60 * 1000;

function extractKeyId(signatureHeader: string): string | null {
  const match = signatureHeader.match(/keyId="([^"]+)"/);
  return match ? match[1] : null;
}

/** Extract clean domain from a URL string */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname) return parsed.hostname;
  } catch { /* fall through */ }
  return url.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
}

interface VerifiedInbox {
  actorUri: string;
  body: Record<string, unknown>;
}

/**
 * Bind an inbound activity to its HTTP-signature signer: the activity's top-level `actor` MUST be
 * on the same host as the cryptographically-verified signer (from `verifyInboxRequest`). Without
 * this, a validly-signed request from instance X could carry `actor: https://victim/actor` and be
 * processed as if it came from the victim — spoofed mirror requests/Accepts (Phase 3), federated
 * content attributed to others, like/boost tampering, etc. CommonPub and Mastodon sign with the
 * actor's own key (we don't support relays/LD-signature forwarding), so host equality is the
 * correct binding. Throws 401 on mismatch; no-ops when `actor` is absent (processInboxActivity
 * rejects a missing actor itself).
 */
export function assertActorMatchesSigner(
  signerActorUri: string,
  body: Record<string, unknown>,
  label: string,
): void {
  const raw = body.actor;
  const actorUri =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object'
        ? ((raw as Record<string, unknown>).id as string | undefined)
        : undefined;
  if (!actorUri) return;

  let signerHost: string;
  let actorHost: string;
  try {
    signerHost = new URL(signerActorUri).hostname;
    actorHost = new URL(actorUri).hostname;
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid activity actor' });
  }
  if (signerHost !== actorHost) {
    console.warn(`[${label}] actor/signer host mismatch: actor=${actorHost}, signer=${signerHost}`);
    throw createError({ statusCode: 401, statusMessage: 'Activity actor does not match request signer' });
  }
}

/**
 * Verify an inbound AP activity request.
 * Checks: body size, signature presence, actor resolution, domain match,
 * Date freshness, and HTTP Signature cryptographic verification.
 *
 * Throws H3Error on any failure.
 */
export async function verifyInboxRequest(event: H3Event, label: string): Promise<VerifiedInbox> {
  // 1. Body size check
  const contentLength = getHeader(event, 'content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    throw createError({ statusCode: 413, statusMessage: 'Payload too large' });
  }

  // 2. Require Signature header
  const signatureHeader = getHeader(event, 'signature');
  if (!signatureHeader) {
    throw createError({ statusCode: 401, statusMessage: 'Missing HTTP Signature' });
  }

  // 3. Extract and validate keyId
  const keyId = extractKeyId(signatureHeader);
  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Signature header: missing keyId' });
  }

  const actorUri = keyId.replace(/#.*$/, '');

  // 4. Resolve actor and public key
  const actor = await resolveActor(actorUri, fetch);
  if (!actor?.publicKey?.publicKeyPem) {
    throw createError({ statusCode: 401, statusMessage: 'Could not resolve actor public key' });
  }

  // 5. Actor domain validation — keyId domain must match resolved actor id domain
  try {
    const keyIdDomain = new URL(actorUri).hostname;
    const actorIdDomain = new URL(actor.id ?? actorUri).hostname;
    if (keyIdDomain !== actorIdDomain) {
      console.warn(`[${label}] Domain mismatch: keyId=${keyIdDomain}, actor.id=${actorIdDomain}`);
      throw createError({ statusCode: 401, statusMessage: 'Actor domain does not match keyId domain' });
    }
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) throw err;
    throw createError({ statusCode: 401, statusMessage: 'Invalid actor URI' });
  }

  // 6. Date header is mandatory + must be fresh (replay-window protection).
  const dateHeader = getHeader(event, 'date');
  if (!dateHeader) {
    throw createError({ statusCode: 401, statusMessage: 'Missing Date header' });
  }
  const requestDate = new Date(dateHeader).getTime();
  if (isNaN(requestDate)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Date header' });
  }
  const skew = Math.abs(Date.now() - requestDate);
  if (skew > MAX_DATE_SKEW_MS) {
    console.warn(`[${label}] Date header too old/new: skew=${Math.round(skew / 1000)}s from ${actorUri}`);
    throw createError({ statusCode: 401, statusMessage: 'Request date too far from server time' });
  }

  // 7. Read the RAW body once. Two uses:
  //    - Hashing for digest verification (must match the sender's digest,
  //      which was computed over the exact bytes on the wire).
  //    - JSON.parse for handler consumption.
  //    `JSON.stringify(JSON.parse(x)) !== x` in general, so we cannot
  //    rebuild the verify-Request from a re-serialized copy without
  //    breaking digest comparison. Item 6 of federation-hardening Stage 3.
  const rawBody = await readRawBody(event, false);
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: 'Empty body' });
  }
  const bodyStr = typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody).toString('utf-8');

  if (bodyStr.length > MAX_BODY_SIZE) {
    throw createError({ statusCode: 413, statusMessage: 'Payload too large' });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(bodyStr);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON body' });
  }

  const url = getRequestURL(event);
  const headers = new Headers();
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value) headers.set(key, Array.isArray(value) ? value[0]! : value);
  }
  const verifyRequest = new Request(url.toString(), {
    method: 'POST',
    headers,
    body: bodyStr,
  });

  // 8. Verify HTTP Signature cryptographically (also enforces the coverage
  //    policy: (request-target), host, date, and — when body is non-empty —
  //    digest MUST all be in the signed headers set; digest must match raw
  //    body SHA-256. Item 7.)
  const signatureValid = await verifyHttpSignature(verifyRequest, actor.publicKey.publicKeyPem);
  if (!signatureValid) {
    console.warn(`[${label}] HTTP Signature verification failed for ${actorUri}`);
    throw createError({ statusCode: 401, statusMessage: 'Invalid HTTP Signature' });
  }

  return { actorUri, body };
}
