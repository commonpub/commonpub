import { processInboxActivity, verifyHttpSignature, resolveActor } from '@commonpub/protocol';
import { createInboxHandlers } from '@commonpub/server';

function extractKeyId(signatureHeader: string): string | null {
  const match = signatureHeader.match(/keyId="([^"]+)"/);
  return match ? match[1] : null;
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname) return parsed.hostname;
  } catch { /* fall through */ }
  return url.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
}

export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  if (getMethod(event) !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  const signatureHeader = getHeader(event, 'signature');
  if (!signatureHeader) {
    throw createError({ statusCode: 401, statusMessage: 'Missing HTTP Signature' });
  }

  const keyId = extractKeyId(signatureHeader);
  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Signature header: missing keyId' });
  }

  const actorUri = keyId.replace(/#.*$/, '');
  const actor = await resolveActor(actorUri, fetch);
  if (!actor?.publicKey?.publicKeyPem) {
    throw createError({ statusCode: 401, statusMessage: 'Could not resolve actor public key' });
  }

  const body = await readBody(event);
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

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

  const signatureValid = await verifyHttpSignature(verifyRequest, actor.publicKey.publicKeyPem);
  if (!signatureValid) {
    console.warn('[user-inbox] HTTP Signature verification failed for', actorUri);
  }

  const db = useDB();
  const runtimeConfig = useRuntimeConfig();
  const domain = extractDomain((runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`);
  const callbacks = createInboxHandlers({ db, domain });

  try {
    const result = await processInboxActivity(body, callbacks);
    if (!result.success) {
      throw createError({ statusCode: 400, statusMessage: result.error ?? 'Invalid activity' });
    }
    return { status: 'accepted' };
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode) throw err;
    console.error('[user-inbox]', err);
    throw createError({ statusCode: 400, statusMessage: 'Invalid activity' });
  }
});
