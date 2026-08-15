import { eq } from 'drizzle-orm';
import { auditLogs, instanceSettings } from '@commonpub/schema';
import {
  type DataRecipient,
  type ProcessingPurposeId,
  dataRecipientSchema,
  dataSharingConfigSchema,
} from '@commonpub/persona';
import type { DB } from '../types.js';
import { getInstanceSetting } from '../admin/admin.js';

/**
 * Named data recipients: who a disclosure can be attributed to.
 *
 * This module answers three questions and nothing else:
 *
 *   1. which recipients does this instance declare (file UNION database);
 *   2. which recipient does this API key belong to;
 *   3. does that recipient's declared purpose list cover the purpose being read.
 *
 * ISOLATION (member-visibility plan D1). This module belongs to the DIRECTORY
 * side of the persona feature, which identifies individuals on purpose with
 * their consent. It must never import `./metrics.js`, and `./metrics.js` must
 * never import it. The aggregate pipeline exists to make individuals
 * UNIDENTIFIABLE (suppression below the bucket floor, population floors,
 * quantisation); routed through one module, either the directory returns
 * nothing or somebody deletes the suppression to make the directory work and
 * silently breaks every aggregate. Two modules, two tests, no shared code path.
 * The only thing the two sides legitimately share is the recipient LIST, which
 * is a config fact, and it lives here.
 *
 * PRECEDENCE: UNION, file wins. Plan section 5.3 of the persona plan settles
 * this explicitly for `dataSharing.recipients`, on the `auth.trustedInstances`
 * precedent (`packages/server/src/federation/oauth.ts`): a recipient is an
 * ADDITIVE fact, not a coherent document like a persona section list, so a
 * database entry supplements the config file rather than replacing it. The FILE
 * wins a collision on `id` because the file is the thing under review in git,
 * and an admin screen must not be able to redefine what a papered agreement in
 * source control says about a recipient's relationship or its agreement
 * reference.
 *
 * DEFENCE IN DEPTH ON READ: everything coming out of the database is re-parsed
 * with `dataRecipientSchema`, the same schema the write path uses, and anything
 * failing it is DROPPED rather than repaired or thrown on. This is the
 * `getEmailBranding` pattern (`packages/server/src/comms/branding.ts`), and it
 * matters more here: `dataRecipientSchema` is what refuses a recipient with no
 * privacy policy URL, and its `.refine` is what refuses a joint or independent
 * controller with no `agreementRef`. A row that predates a schema tightening, or
 * one written around this module through the generic settings route, therefore
 * cannot become a disclosure target.
 */

// --- Setting key and audit action -----------------------------------------------

/**
 * `instance_settings` key holding the admin-managed recipient list.
 *
 * Dotted to match `persona.sections` and `email.branding`, and named for the
 * config path it supplements so an operator reading the settings table can see
 * which half of the union they are looking at.
 */
export const DATA_SHARING_RECIPIENTS_SETTING_KEY = 'dataSharing.recipients';

/** Audit actions this module writes. Literals, so a grep finds every writer. */
export const RECIPIENT_AUDIT_ACTIONS = {
  save: 'dataSharing.recipients.save',
} as const;

/**
 * Cap on the stored half of the union.
 *
 * The same 50 `dataSharingConfigSchema` puts on the file half. It is not
 * arbitrary: `buildPurposeScopeSnapshot` carries every recipient into the
 * consent record a member is shown and keeps that record inside an 8 KB budget,
 * so an unbounded list would either blow the budget or silently truncate the
 * list of who receives the data. Bounded at the point an operator can act on the
 * refusal.
 */
export const MAX_STORED_RECIPIENTS = 50;

// --- Reading ---------------------------------------------------------------------

/** Drop duplicate ids, keeping the FIRST occurrence (see the precedence note). */
function dedupeById(recipients: readonly DataRecipient[]): DataRecipient[] {
  const seen = new Set<string>();
  const out: DataRecipient[] = [];
  for (const recipient of recipients) {
    if (seen.has(recipient.id)) continue;
    seen.add(recipient.id);
    out.push(recipient);
  }
  return out;
}

/**
 * Parse a stored recipient list, dropping every entry that fails the schema.
 *
 * Accepts either a bare array (what {@link setStoredRecipients} writes, and the
 * shape `trusted_instances` uses) or `{ recipients: [...] }`, so a hand-written
 * row or a future provenance wrapper reads rather than silently resolving to no
 * recipients at all.
 *
 * A single bad entry costs that entry, not the list: dropping one malformed
 * recipient leaves the other disclosures attributable, whereas refusing the
 * whole list would take a working recipient offline because an unrelated one was
 * mistyped. The reverse trade would be right for a coherent document; a
 * recipient list is not one.
 */
export function sanitizeStoredRecipients(raw: unknown): DataRecipient[] {
  const array = Array.isArray(raw)
    ? raw
    : raw !== null && typeof raw === 'object' && Array.isArray((raw as { recipients?: unknown }).recipients)
      ? (raw as { recipients: unknown[] }).recipients
      : null;
  if (array === null) return [];

  const kept: DataRecipient[] = [];
  for (const entry of array) {
    const parsed = dataRecipientSchema.safeParse(entry);
    if (parsed.success) kept.push(parsed.data);
  }
  return dedupeById(kept).slice(0, MAX_STORED_RECIPIENTS);
}

/** The database half of the union, sanitized. Empty when nothing is stored. */
export async function getStoredRecipients(db: DB): Promise<DataRecipient[]> {
  const raw = await getInstanceSetting(db, DATA_SHARING_RECIPIENTS_SETTING_KEY);
  if (raw === null) return [];
  return sanitizeStoredRecipients(raw);
}

/** The slice of the operator config this module reads (see `PurposeScopeConfig`). */
export interface RecipientConfig {
  dataSharing?: unknown;
}

/**
 * The config-file half of the union.
 *
 * A malformed `dataSharing` document yields NO recipients rather than throwing,
 * which is the same fail-closed reading `currentPurposeScope` takes: no
 * recipients means no purpose that requires one is offerable, means no consent
 * is collected, means nothing is disclosed. A config typo must never be able to
 * turn a disclosure ON, and it must never be able to make revocation impossible.
 */
export function recipientsFromConfig(config: RecipientConfig): DataRecipient[] {
  const parsed = dataSharingConfigSchema.safeParse(config.dataSharing ?? {});
  if (!parsed.success) return [];
  return dedupeById(parsed.data.recipients);
}

/**
 * Every recipient this instance declares: the config file UNION the database,
 * deduped by `id` with the FILE winning.
 *
 * Order is deterministic (file order, then the stored entries the file did not
 * shadow) so an admin list, a consent snapshot and a test all see the same
 * sequence. It does not affect the scope digest, which sorts and dedupes its
 * inputs itself, but a list that reorders between renders is its own bug.
 *
 * NOT truncated to {@link MAX_STORED_RECIPIENTS}. Each half is capped where it
 * is written; silently dropping the tail of the union here would mean the
 * instance discloses to a recipient the member was never shown, which is exactly
 * backwards. If the union is over the cap the operator has two over-full sources
 * and should see all of them.
 */
export async function effectiveRecipients(
  db: DB,
  config: RecipientConfig,
): Promise<DataRecipient[]> {
  const file = recipientsFromConfig(config);
  const stored = await getStoredRecipients(db);
  return dedupeById([...file, ...stored]);
}

/**
 * The `dataSharing` document with the effective (post-union) recipient list,
 * shaped for `PurposeScopeResolvers.dataSharing`.
 *
 * WHY THIS EXISTS. `currentPurposeScope` reads `config.dataSharing` directly
 * unless a resolver is passed, so without this the scope digest is computed over
 * the FILE recipients alone. An operator adding a recipient through the admin
 * screen would then disclose to a party whose arrival moved no digest, re-asked
 * nobody, and never appeared in the consent snapshot a member was shown. Every
 * route that can reach this module should pass it, for the same reason
 * `PurposeScopeResolvers.sections` exists.
 *
 * Adding or removing a recipient MOVES the digest, which degrades every existing
 * grant to "needs reconfirmation". That is the intended cost, and it is the
 * whole reason a recipient list is part of the digest at all.
 */
export async function effectiveDataSharingDocument(
  db: DB,
  config: RecipientConfig,
): Promise<unknown> {
  const recipients = await effectiveRecipients(db, config);
  const parsed = dataSharingConfigSchema.safeParse(config.dataSharing ?? {});
  // A malformed file document contributes its recipients (none, per
  // `recipientsFromConfig`) and none of its other settings, so the floors and
  // the policy version fall back to the schema defaults rather than to values
  // nobody validated.
  const base = parsed.success ? parsed.data : dataSharingConfigSchema.parse({});
  return { ...base, recipients };
}

// --- Key binding -----------------------------------------------------------------

/**
 * The part of an API key row this module needs.
 *
 * Structural rather than `ApiKey`, so a test (and a route that has already
 * narrowed) can pass a one-key literal without building a whole key row.
 */
export interface RecipientBoundKey {
  recipientId?: string | null;
}

/**
 * Resolve the recipient an API key is bound to, or `null`.
 *
 * `null` on every path that is not an exact match against a declared recipient:
 * no binding at all, a blank binding, or a binding naming a recipient that has
 * since been removed from both the file and the database. The route turns `null`
 * into a 403. That last case is the one worth being deliberate about: an
 * operator who deletes a recipient has withdrawn the disclosure, and the key
 * that belonged to it must stop reading immediately rather than keep working
 * against a name nothing declares. Revoking the key is then cleanup, not the
 * control.
 */
export async function resolveKeyRecipient(
  db: DB,
  config: RecipientConfig,
  apiKey: RecipientBoundKey,
): Promise<DataRecipient | null> {
  const id = apiKey.recipientId?.trim();
  if (!id) return null;
  const recipients = await effectiveRecipients(db, config);
  return recipients.find((r) => r.id === id) ?? null;
}

/**
 * Does this recipient's declared purpose list cover `purpose`?
 *
 * Pure and deliberately narrow: membership of `purposes`, nothing else. The two
 * other refusals in this area are enforced where they belong and are not
 * repeated here, because a second copy of a rule is a second thing to drift:
 *
 * - a joint or independent controller with no `agreementRef` is rejected by
 *   `dataRecipientSchema.refine` at parse time, so an unpapered recipient cannot
 *   reach this function through any reader in this module;
 * - a purpose whose read surface this release does not offer is rejected by
 *   `purposeIsOfferable` / `OFFERED_PROCESSING_PURPOSES`.
 *
 * The caller still has to check the MEMBER's consent. This answers "may this
 * recipient be told anything for this purpose", never "may this recipient be
 * told about this person".
 */
export function recipientCoversPurpose(
  recipient: Pick<DataRecipient, 'purposes'>,
  purpose: ProcessingPurposeId,
): boolean {
  return recipient.purposes.includes(purpose);
}

// --- Writing ---------------------------------------------------------------------

export type SetStoredRecipientsResult =
  | { ok: true; recipients: DataRecipient[] }
  | { ok: false; error: string };

/**
 * Replace the database half of the recipient list.
 *
 * WHOLE-LIST, ALL OR NOTHING. A partial write would leave the instance
 * disclosing to a recipient the operator believed they had removed, so a single
 * invalid entry refuses the whole save with the index and the reason. This is
 * the opposite trade from {@link sanitizeStoredRecipients} on read, and
 * deliberately so: on read the alternative is taking working recipients offline
 * over an unrelated bad row; on write the operator is present and can fix it.
 *
 * NEVER `PUT /api/admin/settings`. That route takes `{ key, value: z.unknown() }`
 * and is how `theme.token_overrides` already bypasses Zod entirely. A recipient
 * list written through it would skip the privacy-policy requirement and the
 * unpapered-controller refusal, which are the two things standing between this
 * feature and an undocumented onward transfer.
 *
 * Writing here MOVES the scope digest (the recipient ids are one of its inputs),
 * so every existing grant degrades to "needs reconfirmation" and members are
 * asked again before anything is disclosed to the new list. Adding a recipient
 * therefore costs a re-ask, by design.
 *
 * @param userId the acting admin. `audit_logs.user_id` is NOT NULL, and an
 *   unattributable change to who receives members' data is not worth having.
 */
export async function setStoredRecipients(
  db: DB,
  userId: string,
  recipients: unknown,
  options: { ip?: string | null } = {},
): Promise<SetStoredRecipientsResult> {
  if (!Array.isArray(recipients)) {
    return { ok: false, error: 'Recipients must be an array' };
  }
  if (recipients.length > MAX_STORED_RECIPIENTS) {
    return {
      ok: false,
      error: `At most ${MAX_STORED_RECIPIENTS} recipients may be stored (received ${recipients.length})`,
    };
  }

  const parsedRecipients: DataRecipient[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of recipients.entries()) {
    const parsed = dataRecipientSchema.safeParse(entry);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path.join('.') ?? '';
      return {
        ok: false,
        error: `recipients[${index}]${path ? `.${path}` : ''}: ${issue?.message ?? 'invalid recipient'}`,
      };
    }
    if (seen.has(parsed.data.id)) {
      return { ok: false, error: `recipients[${index}]: duplicate id "${parsed.data.id}"` };
    }
    seen.add(parsed.data.id);
    parsedRecipients.push(parsed.data);
  }

  const previous = await getStoredRecipients(db);
  const previousIds = new Set(previous.map((r) => r.id));
  const nextIds = new Set(parsedRecipients.map((r) => r.id));

  const now = new Date();
  await db
    .insert(instanceSettings)
    .values({
      key: DATA_SHARING_RECIPIENTS_SETTING_KEY,
      value: parsedRecipients,
      updatedBy: userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: instanceSettings.key,
      set: { value: parsedRecipients, updatedBy: userId, updatedAt: now },
    });

  // The ids, not the count: "who did we start sending members' data to, and
  // when" is the question this row exists to answer, and a count cannot answer
  // it. Bounded by MAX_STORED_RECIPIENTS x the 40-char id cap.
  await db.insert(auditLogs).values({
    userId,
    action: RECIPIENT_AUDIT_ACTIONS.save,
    targetType: 'data_sharing_recipients',
    targetId: DATA_SHARING_RECIPIENTS_SETTING_KEY,
    metadata: {
      count: parsedRecipients.length,
      added: [...nextIds].filter((id) => !previousIds.has(id)),
      removed: [...previousIds].filter((id) => !nextIds.has(id)),
    },
    ipAddress: options.ip ?? null,
  });

  return { ok: true, recipients: parsedRecipients };
}

/**
 * Remove the stored half entirely, so the config file is the whole list again.
 *
 * The revert path `PUT /api/admin/features` never had (persona plan 5.3.2): an
 * admin-added recipient must be removable without a deploy, and an empty stored
 * list must be distinguishable from no stored list at all for the admin screen's
 * provenance display.
 */
export async function clearStoredRecipients(
  db: DB,
  userId: string,
  options: { ip?: string | null } = {},
): Promise<{ removed: boolean }> {
  const existing = await getInstanceSetting(db, DATA_SHARING_RECIPIENTS_SETTING_KEY);
  if (existing === null) return { removed: false };

  const previous = sanitizeStoredRecipients(existing);
  await db
    .delete(instanceSettings)
    .where(eq(instanceSettings.key, DATA_SHARING_RECIPIENTS_SETTING_KEY));

  await db.insert(auditLogs).values({
    userId,
    action: RECIPIENT_AUDIT_ACTIONS.save,
    targetType: 'data_sharing_recipients',
    targetId: DATA_SHARING_RECIPIENTS_SETTING_KEY,
    metadata: { count: 0, added: [], removed: previous.map((r) => r.id) },
    ipAddress: options.ip ?? null,
  });

  return { removed: true };
}
