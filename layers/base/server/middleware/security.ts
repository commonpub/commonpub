// Security middleware — rate limiting + security headers + CSP
import { checkRateLimit, createRateLimitStore, createRedisFailOpenLogger, shouldSkipRateLimit, getSecurityHeaders, buildCspHeader, buildCspDirectives, appendCspSources, getClientIp } from '@commonpub/server';
import { analyticsCspOrigins } from '@commonpub/config/analytics';

// Structured JSON sink for fail-open events. Emits one JSON line per event
// to stdout so Docker logs / Loki / Datadog / CloudWatch can parse without
// regex-scraping. Duplicated from packages/infra/structuredLogger.ts
// because layers/base doesn't depend on @commonpub/infra directly and the
// symbol isn't re-exported via @commonpub/server (which pins to the npm
// registry, not the workspace, in apps/reference). Keep this helper in
// sync with the one in infra if the event shape changes.
function jsonLog(component: string) {
  return (message: string, meta?: Record<string, unknown>) => {
    try {
      const event: Record<string, unknown> = {
        ts: new Date().toISOString(),
        level: 'warn',
        component,
        message,
      };
      if (meta) {
        for (const [k, v] of Object.entries(meta)) {
          if (k === 'ts' || k === 'level' || k === 'component' || k === 'message') continue;
          event[k] = v;
        }
      }
      process.stdout.write(JSON.stringify(event) + '\n');
    } catch {
      // Circular meta; fall through to plain console so the event isn't lost.
      console.warn(`[${component}] ${message}`, meta);
    }
  };
}

// Selects a Redis-backed store when NUXT_REDIS_URL is set, otherwise the
// in-process memory store. Unset env = byte-identical behavior to pre-0.6.
// `onRedisError` is rate-limited: first event logs immediately, subsequent
// events roll up into a one-per-minute summary so a Redis outage doesn't
// flood the log at real traffic.
const store = createRateLimitStore({
  redisUrl: process.env.NUXT_REDIS_URL,
  onRedisError: createRedisFailOpenLogger({
    scope: 'ratelimit:ip',
    sink: jsonLog('ratelimit-ip'),
  }),
});
const isDev = process.env.NODE_ENV !== 'production';

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const pathname = url.pathname;

  // Skip rate limiting for static assets
  if (shouldSkipRateLimit(pathname)) return;

  // Skip rate limiting in development — SSR + HMR + prefetch burns through limits instantly
  if (!isDev) {
    // Trusted client IP for the rate-limit bucket (federation-hardening
    // Item 9). All 3 prod instances run Caddy with `header_up
    // X-Forwarded-For {remote_host}` (overwrite) — XFF chain length 1,
    // leftmost === rightmost, so the previous leftmost-token code was NOT
    // live-exploitable in our setup. The rightmost-token rule here is
    // forward-compatible hardening for self-hosters on nginx-append /
    // multi-proxy topologies; they set CPUB_TRUSTED_PROXY_DEPTH to match
    // their chain (default 1 covers single-proxy append too).
    const ip = getClientIp(event);

    const userId = event.context.auth?.user?.id as string | undefined;
    const { result, headers: rlHeaders } = await checkRateLimit(store, ip, pathname, userId);

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
    // Nuxt SSR emits inline scripts for payload hydration — unsafe-inline is required
    cspDirectives['script-src'] = "'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval' blob:" : '');
    cspDirectives['style-src'] = "'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com";
    cspDirectives['font-src'] = "'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com";
    if (isDev) {
      cspDirectives['connect-src'] = "'self' ws: wss:";
      cspDirectives['worker-src'] = "'self' blob:";
    }
    // Analytics origins are DERIVED from the configured provider, never
    // hardcoded: this middleware ships to every instance, and an instance that
    // measures nothing must keep the tight default. appendCspSources unions
    // rather than assigns, so the dev ws:/wss: above survives.
    //
    // Gated on the FLAG as well as the config block. Declaring a provider is
    // not the same as switching it on: the reference app declares one so its
    // e2e can exercise the consent gate, and without this check commonpub.io
    // shipped a CSP allowing googletagmanager while its own privacy page
    // correctly said it uses no analytics. Those two disagreeing is precisely
    // what deriving everything from one registry is supposed to prevent.
    const cfg = useConfig();
    const analytics = cfg.features.analytics === true
      ? analyticsCspOrigins(cfg.analytics)
      : { script: [], connect: [] };
    appendCspSources(cspDirectives, 'script-src', analytics.script);
    appendCspSources(cspDirectives, 'connect-src', analytics.connect);
    setResponseHeader(event, 'Content-Security-Policy', buildCspHeader(cspDirectives));
  }
});
