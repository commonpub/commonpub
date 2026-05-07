/**
 * Cross-instance identity — Nitro startup wiring.
 *
 * Runs at app init to:
 *
 *   1. Validate that any token-using `features.identity.*` flag has
 *      `CPUB_FED_TOKEN_KEY` set. Throws if misconfigured — the boot
 *      fails loudly rather than 500-ing partway through a real user's
 *      OAuth callback. Only `actingAs` is exempt (UI-only, no token I/O).
 *
 *   2. Register the Mastodon-API-backed FediClient factory so
 *      `run(event, ctx.active, action, input)` can dispatch to remote
 *      handlers when `ctx.active.kind === 'linked'`. Factory closes
 *      over the request-scoped DB handle.
 *
 * Plugin order: this should run early, alongside other infrastructure
 * plugins. Nitro picks up plugins in alphabetical order — file is
 * named `identity-startup.ts` so it sorts before app-level plugins.
 *
 * Phase-skip ergonomics: if no identity flag is enabled, the factory
 * is registered anyway (cheap; the factory is lazy and only executes
 * when `getFediClient` is called). The startup invariant only fires
 * for flags that need the key.
 *
 * See docs/sessions/136-cross-instance-identity-plan.md.
 */
import {
  assertIdentityConfig,
  createMastodonFediClientFactory,
  setFediClientFactory,
} from '@commonpub/server';

export default defineNitroPlugin(() => {
  const config = useConfig();

  // Fails loudly + early if a token-using flag is on without the
  // encryption key. Listed errors include the env var name to set.
  assertIdentityConfig(config);

  // Register the factory exactly once. Subsequent calls would replace
  // (which is fine in tests; in prod this fires once per process).
  setFediClientFactory(createMastodonFediClientFactory(useDB()));
});
