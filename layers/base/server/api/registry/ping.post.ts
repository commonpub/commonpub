import { recordRegistryPing, createRateLimitStore, getClientIp } from '@commonpub/server';
import { verifyInboxRequest, extractDomain } from '../../utils/inbox';

/**
 * POST /api/registry/ping (Phase 4)
 * A signed heartbeat from another CommonPub instance announcing itself to this registry.
 * Gated on `features.actAsRegistry`. Identity is proven by the HTTP signature (the keyId domain
 * must match the resolved actor) — so a domain can only register itself. We derive the domain from
 * the verified actor, then `recordRegistryPing` pulls the instance's public NodeInfo for stats.
 *
 * Defence in depth: the global IP rate-limit middleware caps pre-verification floods; here we add a
 * per-source-domain limit so a verified instance can't spam updates.
 */
const store = createRateLimitStore({ redisUrl: process.env.NUXT_REDIS_URL });
const PRE_TIER = { limit: 20, windowMs: 60_000 }; // coarse per-IP cap BEFORE signature verification
const PING_TIER = { limit: 3, windowMs: 5 * 60 * 1000 }; // 3 pings / 5 min per verified domain

export default defineEventHandler(async (event) => {
  requireFeature('actAsRegistry');
  if (getMethod(event) !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  // h3 types the well-known `Retry-After` header as a number (seconds).
  const reject429 = (resetAt: number): never => {
    setResponseHeader(event, 'Retry-After', Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  };

  // Coarse per-IP cap BEFORE verification: `verifyInboxRequest` resolves the (attacker-controlled)
  // keyId actor over the network, so an unauthenticated caller must not fan that out unbounded.
  const preRl = await store.check(`registry:ping:ip:${getClientIp(event)}`, PRE_TIER);
  if (!preRl.allowed) reject429(preRl.resetAt);

  const { actorUri } = await verifyInboxRequest(event, 'registry-ping');
  const domain = extractDomain(actorUri);

  // Per-verified-domain cap (the signer is now cryptographically known).
  const rl = await store.check(`registry:ping:${domain}`, PING_TIER);
  if (!rl.allowed) reject429(rl.resetAt);

  const result = await recordRegistryPing(useDB(), domain, actorUri);
  return { status: result };
});
