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

  // 6. Date header freshness check
  const dateHeader = getHeader(event, 'date');
  if (dateHeader) {
    const requestDate = new Date(dateHeader).getTime();
    if (!isNaN(requestDate)) {
      const skew = Math.abs(Date.now() - requestDate);
      if (skew > MAX_DATE_SKEW_MS) {
        console.warn(`[${label}] Date header too old/new: skew=${Math.round(skew / 1000)}s from ${actorUri}`);
        throw createError({ statusCode: 401, statusMessage: 'Request date too far from server time' });
      }
    }
  }

  // 7. Read body and reconstruct Request for signature verification
  const body = await readBody(event);
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

  // Body size check on actual content (in case Content-Length was missing/wrong)
  if (bodyStr.length > MAX_BODY_SIZE) {
    throw createError({ statusCode: 413, statusMessage: 'Payload too large' });
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

  // 8. Verify HTTP Signature cryptographically
  const signatureValid = await verifyHttpSignature(verifyRequest, actor.publicKey.publicKeyPem);
  if (!signatureValid) {
    console.warn(`[${label}] HTTP Signature verification failed for ${actorUri}`);
    throw createError({ statusCode: 401, statusMessage: 'Invalid HTTP Signature' });
  }

  return { actorUri, body };
}
