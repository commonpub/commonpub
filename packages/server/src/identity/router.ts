/**
 * Action router — the only place that branches on `active.kind === 'linked'`.
 *
 * Every user-facing action gets one ActionRoute declaration with two
 * halves: `local` (run against this instance's DB as the session user)
 * and `remote` (proxied via FediClient to the linked identity's home).
 * The `run()` helper picks the right half based on which identity is
 * currently active in the request context.
 *
 * Adding a new proxiable action = one new file with an ActionRoute.
 * Existing controllers don't grow `if (linked)` branches.
 *
 * See docs/sessions/136-cross-instance-identity-plan.md.
 */
import type {
  Identity,
  LinkedIdentity,
  NativeIdentity,
  Scope,
} from '@commonpub/auth';
import { hasAllScopes, isUsableLinkedIdentity } from '@commonpub/auth';
import type { FediClient } from './fediClient.js';
import { getFediClient } from './fediClient.js';

/**
 * Event-type generic. The router doesn't care what event/context shape
 * the caller's framework uses — it passes the event through to the
 * `local` handler unchanged. Layer-side code (Nitro/h3) will instantiate
 * `ActionRoute<H3Event, ...>`; framework-agnostic tests use `unknown`.
 *
 * This keeps `@commonpub/server` framework-agnostic (no h3 dep) while
 * still flowing strong types into layer-side controllers.
 */
export interface ActionRoute<TEvent, TIn, TOut> {
  /** Stable name — used for audit logs, scope-error messages, metrics. */
  name: string;
  /** Required scopes when running via a linked identity. Ignored for native. */
  scopes: ReadonlyArray<Scope>;
  /** Handler when the active identity is the session's native user. */
  local(event: TEvent, identity: NativeIdentity, input: TIn): Promise<TOut>;
  /**
   * Handler when the active identity is a linked OAuth grant. Optional —
   * actions that should never be proxied (admin, settings, identity
   * management itself) leave this undefined and `run()` throws
   * `ActionUnavailable` if a linked identity tries to invoke.
   */
  remote?(client: FediClient, identity: LinkedIdentity, input: TIn): Promise<TOut>;
}

export class ActionUnavailable extends Error {
  readonly action: string;
  readonly reason: string;
  constructor(action: string, reason: string) {
    super(`Action "${action}" unavailable: ${reason}`);
    this.name = 'ActionUnavailable';
    this.action = action;
    this.reason = reason;
  }
}

export class InsufficientScopes extends Error {
  readonly action: string;
  readonly required: ReadonlyArray<Scope>;
  readonly granted: ReadonlyArray<Scope>;
  constructor(action: string, required: ReadonlyArray<Scope>, granted: ReadonlyArray<Scope>) {
    super(`Action "${action}" needs scopes [${required.join(', ')}]; have [${granted.join(', ')}]`);
    this.name = 'InsufficientScopes';
    this.action = action;
    this.required = required;
    this.granted = granted;
  }
}

export class LinkedIdentityRevoked extends Error {
  readonly identity: LinkedIdentity;
  constructor(identity: LinkedIdentity) {
    super(`Linked identity ${identity.handle} is revoked; user must re-link`);
    this.name = 'LinkedIdentityRevoked';
    this.identity = identity;
  }
}

/**
 * Dispatch an action against the currently active identity.
 *
 * The active identity is *passed in* rather than read from request
 * context here — this keeps `run()` a pure function of its inputs and
 * makes it trivially unit-testable. The middleware that resolves
 * IdentityContext (Phase 3+) will read `event.context.identity.active`
 * and forward it.
 *
 * Behaviour:
 *   - `active.kind === 'native'`  → call `action.local(event, active, input)`
 *   - `active.kind === 'linked'`  → check scopes + revocation, then call
 *                                   `action.remote(client, active, input)`
 *
 * Throws `ActionUnavailable` if the action has no `remote` half but a
 * linked identity tries it. Throws `LinkedIdentityRevoked` if the
 * grant is revoked. Throws `InsufficientScopes` if the grant doesn't
 * cover what the action needs.
 *
 * Phase 1a: `getFediClient` is unimplemented; the linked path will
 * throw at client construction. Phase 1b plumbs it in.
 */
export async function run<TEvent, TIn, TOut>(
  event: TEvent,
  active: Identity,
  action: ActionRoute<TEvent, TIn, TOut>,
  input: TIn,
): Promise<TOut> {
  if (active.kind === 'native') {
    return action.local(event, active, input);
  }
  // active.kind === 'linked'
  if (!action.remote) {
    throw new ActionUnavailable(action.name, 'not-proxiable');
  }
  if (!isUsableLinkedIdentity(active)) {
    throw new LinkedIdentityRevoked(active);
  }
  if (!hasAllScopes(active.scopes, action.scopes)) {
    throw new InsufficientScopes(action.name, action.scopes, active.scopes);
  }
  const client = await getFediClient(active);
  return action.remote(client, active, input);
}
