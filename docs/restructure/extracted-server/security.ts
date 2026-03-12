import type { Handle } from '@sveltejs/kit';

/** Build CSP directives with optional nonce for script-src */
export function buildCspDirectives(nonce?: string): Record<string, string> {
  const scriptSrc = nonce ? `'self' 'nonce-${nonce}'` : "'self'";
  const styleSrc = nonce ? `'self' 'nonce-${nonce}'` : "'self' 'unsafe-inline'";
  return {
    'default-src': "'self'",
    'script-src': scriptSrc,
    'style-src': styleSrc,
    'img-src': "'self' data: https:",
    'font-src': "'self'",
    'connect-src': "'self'",
    'frame-ancestors': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
  };
}

/** Build a CSP header string from directives */
export function buildCspHeader(directives?: Record<string, string>): string {
  const dirs = directives ?? buildCspDirectives();
  return Object.entries(dirs)
    .map(([key, value]) => `${key} ${value}`)
    .join('; ');
}

/** Security headers applied to every response (static, without nonce) */
export function getSecurityHeaders(isDev: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

  // HSTS only in production
  if (!isDev) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  return headers;
}

/** Cache headers for static assets (hashed filenames) */
export function getStaticCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'public, max-age=31536000, immutable',
  };
}

/** SvelteKit handle hook that adds security headers with nonce-based CSP */
export function createSecurityHook(isDev: boolean): Handle {
  const staticHeaders = getSecurityHeaders(isDev);

  return async ({ event, resolve }) => {
    // Generate a per-request nonce for CSP
    const nonce = isDev ? undefined : crypto.randomUUID().replace(/-/g, '');

    const response = await resolve(event, {
      transformPageChunk: nonce
        ? ({ html }) => html.replace(/%sveltekit\.nonce%/g, nonce)
        : undefined,
    });

    for (const [key, value] of Object.entries(staticHeaders)) {
      response.headers.set(key, value);
    }

    // Add nonce-based CSP in production
    if (!isDev) {
      const cspDirectives = buildCspDirectives(nonce);
      response.headers.set('Content-Security-Policy', buildCspHeader(cspDirectives));
    }

    // Add cache headers for immutable static assets
    if (event.url.pathname.startsWith('/_app/')) {
      const cacheHeaders = getStaticCacheHeaders();
      for (const [key, value] of Object.entries(cacheHeaders)) {
        response.headers.set(key, value);
      }
    }

    return response;
  };
}
