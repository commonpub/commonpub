import {
  apiKeyRateLimit,
  authenticateApiKey,
  logApiKeyUsage,
  touchLastUsed,
  type ApiKey,
} from '@commonpub/server';

declare module 'h3' {
  interface H3EventContext {
    apiKey?: ApiKey;
    apiScopes?: string[];
  }
}

/**
 * Authenticate Bearer-token requests to `/api/public/v1/*`.
 *
 * Returns 404 (not 401) when the feature flag is off — we don't want to leak
 * even the existence of the API surface on instances that haven't opted in.
 *
 * All lookup-failure reasons (missing, malformed, not_found) map to a single
 * 401 response with a generic `Invalid API key` message. Expired keys get
 * their own response so a legitimate consumer knows to rotate — that
 * distinction is safe because the key clearly existed.
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith('/api/public/')) return;

  const config = useConfig();
  if (!config.features.publicApi) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  // CORS preflight. Browsers send OPTIONS with `Origin` and either
  // `Access-Control-Request-Method` or `-Headers`. We reflect the origin
  // only if the admin key allow-list has opted in — but to do that we
  // need to auth first, which preflight doesn't carry. The pragmatic
  // compromise: for preflight, short-circuit with permissive headers for
  // the standard set and let the real request's auth check gate access.
  // No data flows here; the body is empty.
  if (event.method === 'OPTIONS') {
    setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS');
    setResponseHeader(event, 'Access-Control-Allow-Headers', 'Authorization, Content-Type');
    setResponseHeader(event, 'Access-Control-Max-Age', 600);
    const origin = getRequestHeader(event, 'origin');
    if (origin) {
      // Echo origin only on preflight — real requests get the per-key
      // allow-list check below. Browsers that don't trust this echo because
      // credentials aren't involved will simply fall back to the no-CORS path.
      setResponseHeader(event, 'Access-Control-Allow-Origin', origin);
      appendResponseHeader(event, 'Vary', 'Origin');
    }
    return sendNoContent(event);
  }

  const authHeader = getRequestHeader(event, 'authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : undefined;

  const db = useDB();
  const result = await authenticateApiKey(db, token);

  if (!result.ok) {
    if (result.reason === 'expired') {
      throw createError({ statusCode: 401, statusMessage: 'API key expired' });
    }
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid API key. Use Authorization: Bearer <key>.',
    });
  }

  const { key } = result;

  // Per-key rate limit (separate store from IP-based rate limit so a noisy
  // public-API consumer can't DoS the web UI for their own home IP).
  const rl = apiKeyRateLimit.check(key.id, key.rateLimitPerMinute);
  setResponseHeader(event, 'X-RateLimit-Limit', String(rl.limit));
  setResponseHeader(event, 'X-RateLimit-Remaining', String(rl.remaining));
  setResponseHeader(event, 'X-RateLimit-Reset', String(rl.resetAt));
  if (!rl.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' });
  }

  // Per-key CORS allow-list. `null` means server-to-server only (no CORS
  // headers, so browser cross-origin calls are blocked by the browser).
  if (key.allowedOrigins && key.allowedOrigins.length > 0) {
    const origin = getRequestHeader(event, 'origin');
    if (origin && key.allowedOrigins.includes(origin)) {
      setResponseHeader(event, 'Access-Control-Allow-Origin', origin);
      setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS');
      setResponseHeader(event, 'Access-Control-Allow-Headers', 'Authorization, Content-Type');
      appendResponseHeader(event, 'Vary', 'Origin');
    }
  }

  event.context.apiKey = key;
  event.context.apiScopes = key.scopes;

  // Fire-and-forget debounced touch. Any DB error is swallowed — logging is
  // best-effort and must never fail a request.
  touchLastUsed(db, key.id).catch(() => {});

  // Log on response finish (statusCode + latency known only then).
  const start = Date.now();
  event.node.res.on('finish', () => {
    const statusCode = event.node.res.statusCode;
    const latencyMs = Date.now() - start;
    logApiKeyUsage(db, { keyId: key.id, endpoint: path, method: event.method, statusCode, latencyMs })
      .catch(() => {});
  });
});
