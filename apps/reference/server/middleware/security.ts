// Security middleware — rate limiting + security headers
import { RateLimitStore, checkRateLimit, shouldSkipRateLimit, getSecurityHeaders, generateNonce } from '@commonpub/server';

const store = new RateLimitStore();

export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  const pathname = url.pathname;

  // Skip rate limiting for static assets
  if (shouldSkipRateLimit(pathname)) return;

  // Rate limiting
  const ip = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || getRequestHeader(event, 'x-real-ip')
    || 'unknown';

  const { result, headers: rlHeaders } = checkRateLimit(store, ip, pathname);

  for (const [key, value] of Object.entries(rlHeaders)) {
    setResponseHeader(event, key, value);
  }

  if (!result.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
    });
  }

  // Security headers
  const nonce = generateNonce();
  const headers = getSecurityHeaders(nonce);
  for (const [key, value] of Object.entries(headers)) {
    setResponseHeader(event, key, value);
  }
});
