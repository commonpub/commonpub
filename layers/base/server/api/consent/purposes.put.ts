/**
 * PUT /api/consent/purposes — record ONE grant or withdrawal (plan section 6.6).
 *
 * One purpose per request, deliberately. A bulk endpoint invites an "enable all"
 * affordance, and there will not be one: bundled consent is not specific consent
 * under Art. 4(11), and the whole point of this surface is that each decision is
 * taken on its own after reading its own disclosure.
 *
 * The client supplies THREE things and no more: which purpose, which direction,
 * and the scope digest it was shown. The server supplies the policy version, the
 * scope snapshot, the IP and the user agent itself, for the same reason
 * `consent.post.ts` supplies its own terms version: a client-supplied record of
 * what a client claims it displayed is worth nothing under Art. 7(1). The
 * `.strict()` body schema is what enforces that, so a client sending
 * `policyVersion` or `scopeSnapshot` gets a 400 rather than being quietly ignored.
 *
 * Section 14.4 and plan 6.4: `consentInputSchema` is NOT widened, no `sharing:*`
 * row is written into `user_consents`, and the cookie consent system is not
 * touched. `user_purpose_consents` carries the full history on its own.
 *
 * The write itself (supersede-then-insert in one transaction, the no-op dedup on
 * the `(state, scopeDigest, policyVersion)` triple, and the 23505 race handling)
 * belongs to `recordPurposeConsent` in `@commonpub/server`, and its row-level
 * behaviour is covered by that package's integration suite against a real
 * database. This route's job is the gate, the shape, and the 409 handshake.
 */
import { z } from 'zod';
import type { PurposeScopeSnapshot } from '@commonpub/schema';
import {
  PROCESSING_PURPOSE_SPECS,
  type DB,
  type PurposeScope,
  PurposeConsentError,
  PurposeScopeChangedError,
  listPurposeConsentHistory,
  recordPurposeConsent,
} from '@commonpub/server';
import {
  type ConsentPurposeId,
  type ConsentPurposeRecipient,
  type ConsentPurposesPayload,
  buildConsentPurposesPayload,
  resolvePurposeScope,
} from './purposes.get';

/**
 * `scope_digest` is `varchar(16)` and `purpose` is `varchar(24)`, so the caps
 * here are the column widths. A body that could not be stored is rejected at the
 * door rather than at the bind.
 */
const purposeConsentInputSchema = z
  .object({
    purpose: z.string().min(1).max(24),
    /** True to grant, false to withdraw. No third state: there is no stored "denied". */
    grant: z.boolean(),
    /** The digest THIS client was shown. Echoed from `GET /api/consent/purposes`. */
    scopeDigest: z.string().min(1).max(16),
  })
  .strict();

/** How many changed recipients or field keys the diff will name before it truncates. */
const DIFF_LIST_MAX = 20;

/**
 * What changed between the scope the client was shown and the live scope.
 *
 * Advisory, and it says so: `resolved` is false when the server holds no record
 * of what the client's digest covered, which is the normal case for a user who
 * has never acted on this purpose before (a digest is one-way, so there is
 * nothing to invert). The authoritative statement is always "the scope changed,
 * confirm again"; the diff exists so the settings page can say WHICH recipient
 * was added instead of an unexplained re-ask, which is the difference between a
 * disclosure and a nag.
 */
export interface ConsentScopeDiff {
  /** True when a stored snapshot carrying the client's digest was found. */
  resolved: boolean;
  recipientsAdded: ConsentPurposeRecipient[];
  recipientsRemoved: Array<{ id: string; name: string }>;
  /** Aggregatable field keys that started being counted. */
  countedFieldsAdded: string[];
  /** Aggregatable field keys that stopped being counted. */
  countedFieldsRemoved: string[];
  policyVersionChanged: { from: string; to: string } | null;
  /** True when any list above was cut to {@link DIFF_LIST_MAX}. Never claim a partial list is whole. */
  truncated: boolean;
}

export interface PurposeConsentWriteResult {
  ok: true;
  purpose: ConsentPurposeId;
  state: 'granted' | 'revoked';
  /**
   * False when the incoming triple already matched the stored row, so nothing
   * was written. A user re-clicking a toggle onto the value it already holds
   * must not append an unbounded history.
   */
  written: boolean;
  actedAt: string;
  scopeDigest: string;
  policyVersion: string;
}

/**
 * Narrow an untrusted string to a registered purpose id.
 *
 * Unknown ids are a 404 rather than a 400, matching `PurposeNotOfferedError`:
 * as far as a client is concerned an unoffered purpose does not exist, which is
 * the same posture `requireFeature` takes. Deriving the check from the registry
 * record means a purpose added there needs no edit here.
 */
function isConsentPurposeId(value: string): value is ConsentPurposeId {
  return Object.prototype.hasOwnProperty.call(PROCESSING_PURPOSE_SPECS, value);
}

/**
 * Reconstruct what the client was shown from the user's own consent history.
 *
 * Every row stores the snapshot of the disclosure it was taken against, so the
 * newest row carrying the digest the client sent IS what that client rendered.
 * Superseded rows are searched too: the stale case is precisely a grant that has
 * since been replaced.
 *
 * One honest caveat, recorded because it cannot be detected from the row:
 * `buildPurposeScopeSnapshot` may drop trailing `aggregatableFieldKeys` to stay
 * inside its byte budget, so on an instance with an enormous recipient list a
 * dropped key can surface here as a spurious `countedFieldsRemoved` entry. The
 * digest binds the complete key set regardless, so nothing is authorised or
 * refused on the strength of this list.
 */
async function diffAgainstShownScope(
  db: DB,
  userId: string,
  purpose: ConsentPurposeId,
  receivedDigest: string,
  scope: PurposeScope,
): Promise<ConsentScopeDiff> {
  const history = await listPurposeConsentHistory(db, userId);
  const shown = history.find(
    (row) => row.purpose === purpose && row.scopeDigest === receivedDigest,
  )?.scopeSnapshot;

  const liveRecipients = scope.recipients.filter((r) => r.purposes.includes(purpose));
  const liveFieldKeys = scope.aggregatableFieldKeys;

  if (!shown) {
    return {
      resolved: false,
      recipientsAdded: [],
      recipientsRemoved: [],
      countedFieldsAdded: [],
      countedFieldsRemoved: [],
      // The policy version IS knowable without the snapshot only when it moved,
      // and it is not knowable at all here, so it stays null rather than
      // guessing. An unresolved diff claims nothing.
      policyVersionChanged: null,
      truncated: false,
    };
  }

  const snapshot: PurposeScopeSnapshot = shown;
  const shownRecipientIds = new Set(snapshot.recipients.map((r) => r.id));
  const liveRecipientIds = new Set(liveRecipients.map((r) => r.id));
  const shownFieldKeys = new Set(snapshot.aggregatableFieldKeys);
  const liveFieldKeySet = new Set(liveFieldKeys);

  const recipientsAdded: ConsentPurposeRecipient[] = liveRecipients
    .filter((r) => !shownRecipientIds.has(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      relationship: r.relationship,
      privacyPolicyUrl: r.privacyPolicyUrl,
    }));
  const recipientsRemoved = snapshot.recipients
    .filter((r) => !liveRecipientIds.has(r.id))
    .map((r) => ({ id: r.id, name: r.name }));
  const countedFieldsAdded = liveFieldKeys.filter((k) => !shownFieldKeys.has(k));
  const countedFieldsRemoved = snapshot.aggregatableFieldKeys.filter(
    (k) => !liveFieldKeySet.has(k),
  );

  const truncated =
    recipientsAdded.length > DIFF_LIST_MAX
    || recipientsRemoved.length > DIFF_LIST_MAX
    || countedFieldsAdded.length > DIFF_LIST_MAX
    || countedFieldsRemoved.length > DIFF_LIST_MAX;

  return {
    resolved: true,
    recipientsAdded: recipientsAdded.slice(0, DIFF_LIST_MAX),
    recipientsRemoved: recipientsRemoved.slice(0, DIFF_LIST_MAX),
    countedFieldsAdded: countedFieldsAdded.slice(0, DIFF_LIST_MAX),
    countedFieldsRemoved: countedFieldsRemoved.slice(0, DIFF_LIST_MAX),
    policyVersionChanged:
      snapshot.policyVersion === scope.policyVersion
        ? null
        : { from: snapshot.policyVersion, to: scope.policyVersion },
    truncated,
  };
}

/**
 * The 409 body for a stale digest (plan 6.6).
 *
 * It carries the full NEW purpose list plus the diff, so the settings page can
 * render the change inline above the affected card, leave the toggle where the
 * user left it, and require one more deliberate click. The pending grant is
 * never auto-applied and the request is never auto-retried, because that would
 * record consent against a disclosure the user has not read. `retryable: false`
 * says so to any client that reads the flag instead of the copy.
 */
interface ScopeChangedErrorData {
  code: 'SCOPE_CHANGED';
  retryable: false;
  /** The live digest the client must confirm against. */
  expectedScopeDigest: string;
  /** The digest the client sent, echoed so it can tell a stale tab from a race. */
  receivedScopeDigest: string;
  diff: ConsentScopeDiff;
  purposes: ConsentPurposesPayload['purposes'];
  policyVersion: string;
}

export default defineEventHandler(async (event): Promise<PurposeConsentWriteResult> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();

  const body = await parseBody(event, purposeConsentInputSchema);

  // ONLY THE GRANT DIRECTION IS GATED.
  //
  // `recordPurposeConsent` is careful that a withdrawal is never refused for an
  // unoffered purpose ("a user who cannot then turn it off has been trapped by a
  // config change"), and that care was undone one layer up by gating the whole
  // route: an operator switching `dataSharingConsents` off to revise their
  // recipient copy took `/settings/privacy` and this route down with it while
  // live grants stood. Withdrawal must be at least as easy as consent
  // (Art. 7(3)), so it survives the flag. The body is parsed first because the
  // direction is what decides the gate.
  if (body.grant) requireFeature('dataSharingConsents');
  if (!isConsentPurposeId(body.purpose)) {
    throw createError({
      statusCode: 404,
      statusMessage: `Purpose "${body.purpose}" is not offered on this instance`,
      data: { code: 'PURPOSE_NOT_OFFERED', retryable: false },
    });
  }
  const purpose = body.purpose;

  const scope = await resolvePurposeScope(db, config);
  const userAgent = getRequestHeader(event, 'user-agent') ?? null;

  try {
    const result = await recordPurposeConsent(db, {
      userId: user.id,
      purpose,
      grant: body.grant,
      scopeDigest: body.scopeDigest,
      scope,
      source: 'settings',
      ip: getRequestIP(event) ?? null,
      // The column is unbounded `text` and the header is attacker-controlled.
      // 512 is past every real user agent and short enough that a scripted
      // header cannot grow the consent log.
      userAgent: userAgent === null ? null : userAgent.slice(0, 512),
    });

    return {
      ok: true,
      purpose,
      state: result.state,
      written: result.written,
      actedAt: result.actedAt.toISOString(),
      scopeDigest: result.scopeDigest,
      policyVersion: result.policyVersion,
    };
  } catch (err: unknown) {
    if (err instanceof PurposeScopeChangedError) {
      const data: ScopeChangedErrorData = {
        code: 'SCOPE_CHANGED',
        retryable: false,
        expectedScopeDigest: err.expectedScopeDigest,
        receivedScopeDigest: err.receivedScopeDigest,
        diff: await diffAgainstShownScope(db, user.id, purpose, err.receivedScopeDigest, scope),
        purposes: (await buildConsentPurposesPayload(db, user.id, scope)).purposes,
        policyVersion: scope.policyVersion,
      };
      throw createError({ statusCode: 409, statusMessage: err.message, data });
    }
    // Every other failure this service raises already carries the status a route
    // should surface, so the mapping lives on the error and two routes cannot
    // disagree about what a lost race or an unoffered purpose means.
    if (err instanceof PurposeConsentError) {
      throw createError({
        statusCode: err.status,
        statusMessage: err.message,
        data: { code: err.code, retryable: err.retryable },
      });
    }
    throw err;
  }
});
