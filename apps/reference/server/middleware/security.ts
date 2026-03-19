// Security middleware — rate limiting + security headers + CSP
import { RateLimitStore, checkRateLimit, shouldSkipRateLimit, getSecurityHeaders, generateNonce, buildCspHeader, buildCspDirectives } from '@commonpub/server';

const store = new RateLimitStore();
const isDev = process.env.NODE_ENV !== 'production';

export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  const pathname = url.pathname;

  // Skip rate limiting for static assets
  if (shouldSkipRateLimit(pathname)) return;

  // Skip rate limiting in development — SSR + HMR + prefetch burns through limits instantly
  if (!isDev) {
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
  }

  // Security headers
  const headers = getSecurityHeaders(isDev);
  for (const [key, value] of Object.entries(headers)) {
    setResponseHeader(event, key, value);
  }

  // Content Security Policy — skip for API responses (JSON doesn't need CSP)
  if (!pathname.startsWith('/api/')) {
    const cspDirectives = buildCspDirectives();
    // In dev, allow unsafe-eval for HMR and inline styles for Nuxt
    if (isDev) {
      cspDirectives['script-src'] = "'self' 'unsafe-inline' 'unsafe-eval'";
      cspDirectives['style-src'] = "'self' 'unsafe-inline'";
      cspDirectives['connect-src'] = "'self' ws: wss:";
    }
    setResponseHeader(event, 'Content-Security-Policy', buildCspHeader(cspDirectives));
  }
});
