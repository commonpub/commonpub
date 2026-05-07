/**
 * Identity-configuration startup invariants.
 *
 * Cross-instance delegated authorization stores OAuth bearer tokens at
 * rest under a symmetric key (`CPUB_FED_TOKEN_KEY`). If any feature
 * flag that *uses* tokens is enabled but the key is missing, the
 * operator has misconfigured the deploy — better to refuse to start
 * than to fail at first OAuth callback when a real user is mid-sign-in.
 *
 * Phase 1b plugs this into a Nitro plugin that runs at app init:
 *
 *     // layers/base/server/plugins/identity-startup.ts
 *     export default defineNitroPlugin(() => {
 *       assertIdentityConfig(useConfig());
 *     });
 *
 * `actingAs` does NOT need the key — it's purely a UI identity-context
 * switcher and doesn't store tokens. Listed exclusion below.
 */
import type { CommonPubConfig } from '@commonpub/config';
import { isTokenKeyConfigured } from '@commonpub/infra';

export interface IdentityConfigCheckResult {
  ok: boolean;
  errors: ReadonlyArray<string>;
}

/**
 * True iff this flag set requires an active `CPUB_FED_TOKEN_KEY`.
 * `actingAs` alone is fine — it's UI state, not token I/O.
 */
function requiresTokenKey(id: CommonPubConfig['features']['identity']): boolean {
  return (
    id.linkRemoteAccounts ||
    id.signInWithRemote ||
    id.remoteInteract ||
    id.remotePublish
  );
}

/**
 * Inspect the config; return the list of identity-related
 * misconfigurations. Empty errors → `ok: true`.
 *
 * Pure function: no env mutation, no I/O beyond reading the env var
 * (which `isTokenKeyConfigured` does without logging the key).
 */
export function checkIdentityConfig(config: CommonPubConfig): IdentityConfigCheckResult {
  const errors: string[] = [];
  const id = config.features.identity;

  if (requiresTokenKey(id) && !isTokenKeyConfigured()) {
    errors.push(
      'CPUB_FED_TOKEN_KEY env var must be set when any of ' +
      'features.identity.{linkRemoteAccounts, signInWithRemote, remoteInteract, remotePublish} ' +
      'is enabled. Generate with: openssl rand -hex 32',
    );
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Same as `checkIdentityConfig` but throws on any error. Use at
 * Nitro-plugin startup so a misconfigured deploy fails to boot rather
 * than 500-ing on first user OAuth attempt.
 *
 * Error message lists ALL detected problems (not just the first) so
 * operators can fix everything in one go.
 */
export function assertIdentityConfig(config: CommonPubConfig): void {
  const result = checkIdentityConfig(config);
  if (!result.ok) {
    throw new Error(
      `Cross-instance identity misconfigured:\n  - ${result.errors.join('\n  - ')}`,
    );
  }
}
