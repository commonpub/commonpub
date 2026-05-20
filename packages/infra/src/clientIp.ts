/**
 * Client-IP extraction from a Nitro/h3 request, hardened against
 * X-Forwarded-For spoofing.
 *
 * Federation-hardening Item 9. The previous pattern at
 * `layers/base/server/middleware/security.ts:57-59` (and four other sites)
 * read the LEFTMOST XFF token. In a deployment where the proxy APPENDS
 * to XFF (nginx `$proxy_add_x_forwarded_for`), the leftmost entry is
 * whatever the client put there → an attacker rotating
 * `X-Forwarded-For: <random>` gets a fresh rate-limit bucket per request,
 * defeating the auth:5/min brute-force tier.
 *
 * The fix is to read the RIGHTMOST token (the address appended by our
 * last trusted proxy). For multi-proxy deployments (CDN → nginx) set
 * `CPUB_TRUSTED_PROXY_DEPTH=N` so the helper reads index `length - N`.
 *
 * **Scope on our prod**: all 3 CommonPub instances run Caddy with
 *   `header_up X-Forwarded-For {remote_host}`
 * which OVERWRITES rather than appends — XFF chain length is always 1,
 * so leftmost === rightmost and the old code was NOT live-exploitable
 * on commonpub.io / deveco.io / heatsynclabs.io. This change is
 * forward-compatible hardening for self-hosters who run nginx-append
 * or multi-proxy topologies; depth=1 (default) is correct for both
 * the Caddy-overwrite and nginx-single-proxy cases without operator
 * action.
 *
 * If XFF is absent, falls back to `X-Real-IP` (also typically set by the
 * reverse proxy) and finally to the socket's `remoteAddress`. The
 * sentinel `'unknown'` is returned only when every source is missing
 * (no proxy + raw IPC sockets in tests) so the rate-limit key remains a
 * stable string.
 */
/**
 * Minimal event shape this helper reads. Defined locally so `@commonpub/infra`
 * stays framework-agnostic (no `h3` dependency). H3's `H3Event` is
 * structurally compatible — Nitro middleware can pass `event` directly.
 */
export interface ClientIpEvent {
  node?: {
    req?: {
      headers?: Record<string, string | string[] | undefined>;
      socket?: { remoteAddress?: string };
    };
  };
}

export interface GetClientIpOptions {
  /**
   * Number of trusted proxies in front of this server. The helper reads
   * the XFF token at index `length - trustedProxyDepth` (clamped to 0).
   * Default 1; reads `CPUB_TRUSTED_PROXY_DEPTH` env when option omitted.
   * Set to 0 to skip XFF entirely.
   */
  trustedProxyDepth?: number;
}

const FALLBACK_DEPTH = 1;

function parseDepth(opts?: GetClientIpOptions): number {
  if (opts?.trustedProxyDepth !== undefined) return opts.trustedProxyDepth;
  const envRaw = process.env.CPUB_TRUSTED_PROXY_DEPTH;
  if (!envRaw) return FALLBACK_DEPTH;
  const n = Number(envRaw);
  if (!Number.isFinite(n) || n < 0) return FALLBACK_DEPTH;
  return Math.floor(n);
}

/**
 * Resolve the trusted client IP for a Nitro/h3 event. See module doc for
 * the spoofing-resistance rationale.
 *
 * Pure with respect to its inputs (event header lookups + env), so safe
 * to call from middleware that runs before `event.context` is populated.
 */
export function getClientIp(event: ClientIpEvent, opts?: GetClientIpOptions): string {
  const depth = parseDepth(opts);
  const headers = event.node?.req?.headers ?? {};

  if (depth > 0) {
    const rawXff = headers['x-forwarded-for'];
    const xff = Array.isArray(rawXff) ? rawXff.join(',') : rawXff;
    if (typeof xff === 'string' && xff.length > 0) {
      const tokens = xff.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
      if (tokens.length > 0) {
        const idx = Math.max(0, tokens.length - depth);
        return tokens[idx]!;
      }
    }
  }

  const rawReal = headers['x-real-ip'];
  const xRealIp = Array.isArray(rawReal) ? rawReal[0] : rawReal;
  if (typeof xRealIp === 'string' && xRealIp.length > 0) return xRealIp;

  const remote = event.node?.req?.socket?.remoteAddress;
  if (typeof remote === 'string' && remote.length > 0) return remote;

  return 'unknown';
}
