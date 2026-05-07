/**
 * Identity types for cross-instance delegated authorization.
 *
 * Phase 1a foundation. The runtime resolver, action router, and federation
 * client live in @commonpub/server (so they can read DB rows and speak
 * HTTP). The TYPES live here in @commonpub/auth so they can be referenced
 * from anywhere — schema, server, layer, third-party plugins — without
 * dragging in server runtime code.
 *
 * See docs/sessions/136-cross-instance-identity-plan.md for the full
 * design + phased rollout. The TL;DR: a session has one native identity
 * (the local Better Auth user) and zero or more linked identities
 * (OAuth grants on other Mastodon-API-compatible instances). The user
 * picks which identity is "active" via UI; everything else flows from
 * that.
 */

/**
 * OAuth scope vocabulary. Mirrors Mastodon's scope strings where they
 * overlap, plus an `interact` shorthand for like/comment/follow that's
 * convenient at the policy layer (Mastodon splits these across `write`).
 *
 * - read     : view profile, follows, timelines
 * - write    : write profile, follow/block, manage media
 * - follow   : create/delete follow relationships (Mastodon legacy alias)
 * - publish  : create/edit/delete posts
 * - interact : like/comment/repost (subset of write, called out for
 *              fine-grained UI prompts)
 *
 * Stored as `text[]` on `federated_accounts.scopes`. Match against
 * `SCOPE_VALUES` at deserialization time to drop unknown values.
 */
export const SCOPE_VALUES = ['read', 'write', 'follow', 'publish', 'interact'] as const;
export type Scope = (typeof SCOPE_VALUES)[number];

export function isScope(value: string): value is Scope {
  return (SCOPE_VALUES as ReadonlyArray<string>).includes(value);
}

/**
 * Detected remote AP server software. Used to route protocol differences
 * (e.g., Mastodon's `/api/v1/apps` vs CommonPub's own DCR endpoint, or
 * Pleroma's chat surface vs Mastodon's lack of one). Detected at link
 * time via WebFinger / OIDC discovery; stored on
 * `federated_accounts.software_kind`.
 */
export const SOFTWARE_KIND_VALUES = [
  'mastodon',
  'pleroma',
  'cpub',
  'gotosocial',
  'akkoma',
  'firefish',
  'unknown',
] as const;
export type SoftwareKind = (typeof SOFTWARE_KIND_VALUES)[number];

export function isSoftwareKind(value: string): value is SoftwareKind {
  return (SOFTWARE_KIND_VALUES as ReadonlyArray<string>).includes(value);
}

interface IdentityCommon {
  /** Stable per-identity id. For native = users.id, for linked = federated_accounts.id. */
  id: string;
  /** Local user this identity belongs to (the Better Auth user behind the session). */
  userId: string;
  /** Bare username (no host). */
  username: string;
  /** Origin instance domain (e.g., 'commonpub.io'). */
  instance: string;
  /** Canonical AP actor URI for this identity. */
  actorUri: string;
  /** Display handle: `@username@instance`. Always full-qualified — never a bare `@username`. */
  handle: string;
}

export interface NativeIdentity extends IdentityCommon {
  kind: 'native';
}

export interface LinkedIdentity extends IdentityCommon {
  kind: 'linked';
  /** Granted OAuth scopes. Empty array means link exists but no actions allowed. */
  scopes: ReadonlyArray<Scope>;
  /** Detected remote software (drives client-protocol selection). */
  softwareKind: SoftwareKind;
  /**
   * If non-null, this grant was revoked (either remotely via 401 or
   * locally via user "Unlink"). Row is kept for audit history but cannot
   * be used for actions until re-linked.
   */
  revokedAt: Date | null;
}

export type Identity = NativeIdentity | LinkedIdentity;

/**
 * The full identity surface for a single request. Resolved once in
 * middleware (Phase 3+ work; Phase 1a only defines the shape).
 *
 * - session: always the native user behind the Better Auth session
 * - active : whoever the session is currently acting as (may === session)
 * - available: native + all non-revoked linked identities
 *
 * If `active.kind === 'linked'`, UI should show the persistent
 * acting-as banner; controllers route through the `run()` helper, which
 * dispatches to local or remote handlers per ActionRoute.
 */
export interface IdentityContext {
  session: NativeIdentity;
  active: Identity;
  available: ReadonlyArray<Identity>;
}

/**
 * Build a canonical handle. Always full-qualified. Strips a single
 * leading `@` from username (Mastodon-style handles often have it).
 * Never lowercases the username — instances may be case-preserving.
 */
export function makeHandle(username: string, instance: string): string {
  const stripped = username.startsWith('@') ? username.slice(1) : username;
  return `@${stripped}@${instance}`;
}

/**
 * Parse `@user@host` / `user@host` / `acct:user@host` into parts.
 * Returns null if the input doesn't match any of these shapes (e.g.,
 * a bare username, or an email — which is *intentionally* not the same
 * thing despite shared `@` syntax).
 */
export function parseHandle(input: string): { username: string; instance: string } | null {
  const trimmed = input.trim().replace(/^acct:/i, '').replace(/^@/, '');
  // Must contain exactly one '@' for username@instance
  const at = trimmed.indexOf('@');
  if (at <= 0 || at !== trimmed.lastIndexOf('@')) return null;
  const username = trimmed.slice(0, at);
  const instance = trimmed.slice(at + 1).toLowerCase();
  if (!username || !instance) return null;
  // Instance must look like a domain (very loose check; full validation
  // happens at WebFinger probe time)
  if (!/[a-z0-9]/i.test(instance) || !instance.includes('.')) return null;
  return { username, instance };
}

/**
 * True iff `granted` covers every scope in `required`. Used as the
 * pre-flight check in the action router before dispatching to a
 * remote-proxied action handler.
 */
export function hasAllScopes(
  granted: ReadonlyArray<Scope>,
  required: ReadonlyArray<Scope>,
): boolean {
  return required.every((scope) => granted.includes(scope));
}

/**
 * Filter an array of strings to only known Scope values. Use when
 * deserializing from DB / external API to drop unknowns safely.
 */
export function coerceScopes(input: ReadonlyArray<string>): Scope[] {
  return input.filter(isScope);
}

/**
 * True iff `identity` is a linked identity with an active (non-revoked)
 * grant. Use as a guard before reaching for `identity.scopes` etc.
 */
export function isUsableLinkedIdentity(identity: Identity): identity is LinkedIdentity & { revokedAt: null } {
  return identity.kind === 'linked' && identity.revokedAt === null;
}
