/**
 * GET /api/admin/data-sharing/recipients
 *
 * The read side of the recipients admin (member-visibility plan section 6).
 * A named recipient has to exist before an API key can bind to one, so this is
 * the screen that turns "who receives members' data" from a line in a git file
 * into something an operator can see, check and change.
 *
 * TWO LISTS, NOT ONE, following `federation/trusted-instances.get.ts`. The
 * config file half is READ ONLY here: it is under review in git, it wins a
 * collision on `id` (see the precedence note on `effectiveRecipients`), and an
 * admin screen that could silently redefine what a papered agreement in source
 * control says about a recipient's relationship would defeat the point of
 * having the file. The database half is the editable one. Rendering them as one
 * merged list would make the read-only half look editable and hide which of the
 * two an operator has to change.
 *
 * WHAT THIS ROUTE ADDS BEYOND THE TWO LISTS, and why each earns its place:
 *
 * 1. `droppedConfigEntries` and `configError`. `recipientsFromConfig` parses the
 *    WHOLE `dataSharing` document and returns NO recipients when any part of it
 *    fails, and `sanitizeStoredRecipients` drops a bad stored entry silently.
 *    Both are the right fail-closed reading, and both are invisible: an operator
 *    who wrote a recipient into `commonpub.config.ts` and mistyped one field
 *    sees an empty list with no error anywhere. This route re-parses each raw
 *    entry on its own and reports what was dropped and why, so a config typo
 *    reads as a config typo rather than as "the feature does not work".
 *
 * 2. `purposes[].blocker`. `purposeIsOfferable` refuses a purpose for four
 *    different reasons and says nothing about which. The most important is the
 *    unpapered one: a joint or independent controller with no `agreementRef`
 *    makes the purpose unofferable for EVERY recipient covering it, not just for
 *    itself. An operator staring at a toggle that never appears on
 *    `/settings/privacy` has no way to discover that from the outside.
 *
 *    The gate is never recomputed here. `offerable` is read from
 *    `currentPurposeScope`, which calls the real `purposeIsOfferable`; `blocker`
 *    only EXPLAINS a refusal that function already made. If the explanation ever
 *    drifts from the rule, the worst case is a wrong sentence, never a wrong
 *    gate.
 *
 * 3. `scopeDigest` and `policyVersion`. Saving a recipient list moves the
 *    digest, which degrades every existing grant to "needs reconfirmation".
 *    That cost has to be visible BEFORE the operator presses Save, and showing
 *    the current digest is how the page can say the sentence honestly.
 *
 * The scope is resolved with `effectiveDataSharingDocument`, so the digest shown
 * here is computed over the FILE UNION DATABASE recipient list. Reading
 * `config.dataSharing` directly (the default resolver) would compute it over the
 * file half alone, and an admin-added recipient would then appear on this screen
 * beside a digest that never moved for it.
 *
 * No member data of any kind is returned. This is the configuration surface;
 * the disclosure record lives on `disclosures.get.ts` beside it.
 */
import {
  OFFERED_PROCESSING_PURPOSES,
  PROCESSING_PURPOSES,
  PROCESSING_PURPOSE_SPECS,
  currentPurposeScope,
  effectiveDataSharingDocument,
  effectiveRecipients,
  getStoredRecipients,
  recipientsFromConfig,
  MAX_STORED_RECIPIENTS,
  type ProcessingPurposeId,
} from '@commonpub/server';
// The two Zod schemas below are owned by `@commonpub/persona`, the pure brain,
// and are NOT on the `@commonpub/server` barrel today. `layers/base` declares
// `@commonpub/persona` as a direct dependency (pinned by
// `server/api/consent/__tests__/purposes-contract.test.ts`), and the
// "server barrel only" rule is scoped to `server/api/admin/persona/**`, which
// this directory is not. Reported as a barrel gap rather than left unexplained:
// the natural home for both is the persona re-export block in
// `packages/server/src/persona/index.ts`.
import { dataRecipientSchema, dataSharingConfigSchema } from '@commonpub/persona';
import type { DataRecipient } from '@commonpub/persona';

/**
 * Why `purposeIsOfferable` refused a purpose. Null when it did not refuse.
 *
 * There was a fourth reason, `no_countable_field`, and it is deleted rather
 * than kept as a branch that can never be taken. It was reachable through
 * exactly one purpose, `profile_analytics`, whose spec set the countable-field
 * requirement; that purpose is gone, the requirement went with it, and instance
 * statistics are no longer a consent purpose at all.
 */
export type PurposeBlocker =
  | 'not_offered_in_release'
  | 'no_recipient'
  | 'unpapered_recipient';

export interface AdminRecipientView extends DataRecipient {
  /** Which half of the union this entry came from. Config entries are read only. */
  source: 'config' | 'database';
  /**
   * True on a STORED entry whose `id` a config entry also declares. The file
   * wins, so this row is stored but not in force, which is otherwise a silent
   * no-op an operator can stare at for a long time.
   */
  shadowedByConfig: boolean;
  /**
   * A joint or independent controller with no `agreementRef`.
   *
   * Structurally unreachable through either reader (`dataRecipientSchema`
   * refuses it at parse time, which is why an unpapered entry lands in
   * `droppedConfigEntries` instead), and carried anyway so the page renders one
   * warning from one field for both the saved list and the draft an operator is
   * typing. A warning that only exists in the form is a warning nobody sees
   * again after they save.
   */
  unpapered: boolean;
}

/** A raw `dataSharing.recipients` entry the schema refused, with the reason. */
export interface DroppedRecipientEntry {
  /** Position in the raw config array, so an operator can find the line. */
  index: number;
  /** Best-effort id, for a human-readable pointer. Null when it is not a string. */
  id: string | null;
  /** `path: message`, from the first Zod issue. */
  error: string;
}

export interface AdminPurposeView {
  id: ProcessingPurposeId;
  label: string;
  /** Can a member be asked for this purpose right now? From `currentPurposeScope`. */
  offerable: boolean;
  /** Why not. Null when `offerable`. Explanatory only, never the gate. */
  blocker: PurposeBlocker | null;
  requiresRecipients: boolean;
  /** Ids of declared recipients covering this purpose, in effective order. */
  recipientIds: string[];
}

export interface AdminDataSharingRecipientsResponse {
  configRecipients: AdminRecipientView[];
  storedRecipients: AdminRecipientView[];
  /** Non-null when the whole `dataSharing` document failed to parse. */
  configError: string | null;
  droppedConfigEntries: DroppedRecipientEntry[];
  purposes: AdminPurposeView[];
  /** The purposes whose read surface exists in this release. */
  offeredPurposes: ProcessingPurposeId[];
  /** Over the file UNION database list, so a stored recipient is in it. */
  scopeDigest: string;
  policyVersion: string;
  maxStoredRecipients: number;
  /** How long a `disclosure_events` row is kept, from `dataSharing`. */
  disclosureRetentionYears: number;
  flags: {
    dataSharingConsents: boolean;
    memberDirectory: boolean;
  };
}

/** `path: message` from the first issue, which is what an operator can act on. */
function firstIssue(error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> }): string {
  const issue = error.issues[0];
  if (issue === undefined) return 'invalid';
  const path = issue.path.map(String).join('.');
  return path === '' ? issue.message : `${path}: ${issue.message}`;
}

function isUnpapered(recipient: DataRecipient): boolean {
  return recipient.relationship !== 'processor' && !recipient.agreementRef;
}

export default defineEventHandler(
  async (event): Promise<AdminDataSharingRecipientsResponse> => {
    requireFeature('admin');
    requireFeature('persona');
    requirePermission(event, 'settings.manage');

    const db = useDB();
    const config = useConfig();

    const [fromConfig, stored, effective, scope] = await Promise.all([
      Promise.resolve(recipientsFromConfig(config)),
      getStoredRecipients(db),
      effectiveRecipients(db, config),
      currentPurposeScope(db, config, { dataSharing: effectiveDataSharingDocument }),
    ]);

    const configIds = new Set(fromConfig.map((r) => r.id));

    // --- What the config file declared and the parser refused -----------------
    const rawSharing = (config as { dataSharing?: unknown }).dataSharing;
    const docParsed = dataSharingConfigSchema.safeParse(rawSharing ?? {});
    const configError = docParsed.success ? null : firstIssue(docParsed.error);

    const rawList: unknown[] =
      rawSharing !== null &&
      typeof rawSharing === 'object' &&
      Array.isArray((rawSharing as { recipients?: unknown }).recipients)
        ? ((rawSharing as { recipients: unknown[] }).recipients)
        : [];

    const droppedConfigEntries: DroppedRecipientEntry[] = [];
    rawList.forEach((entry, index) => {
      const parsed = dataRecipientSchema.safeParse(entry);
      if (parsed.success) return;
      const rawId =
        entry !== null && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string'
          ? (entry as { id: string }).id
          : null;
      droppedConfigEntries.push({ index, id: rawId, error: firstIssue(parsed.error) });
    });

    // --- Purposes, and why each one is or is not offerable --------------------
    const offered = OFFERED_PROCESSING_PURPOSES;

    const purposes: AdminPurposeView[] = PROCESSING_PURPOSES.map((id) => {
      const spec = PROCESSING_PURPOSE_SPECS[id];
      const covering = effective.filter((r) => r.purposes.includes(id));
      const offerable = scope.offerablePurposes.includes(id);

      // Order matters: it is the order `purposeIsOfferable` tests them in, so
      // the first true one is the reason that function actually stopped on.
      let blocker: PurposeBlocker | null = null;
      if (!offerable) {
        if (!offered.includes(id)) blocker = 'not_offered_in_release';
        else if (spec.requiresRecipients && covering.length === 0) blocker = 'no_recipient';
        else if (covering.some(isUnpapered)) blocker = 'unpapered_recipient';
      }

      return {
        id,
        label: spec.label,
        offerable,
        blocker,
        requiresRecipients: spec.requiresRecipients,
        recipientIds: covering.map((r) => r.id),
      };
    });

    const toView = (
      recipient: DataRecipient,
      source: 'config' | 'database',
    ): AdminRecipientView => ({
      ...recipient,
      source,
      shadowedByConfig: source === 'database' && configIds.has(recipient.id),
      unpapered: isUnpapered(recipient),
    });

    // `disclosureRetentionYears` from the parsed document, so the number shown
    // beside the disclosure record is the one the purge job will actually use.
    const retentionYears = docParsed.success
      ? docParsed.data.disclosureRetentionYears
      : dataSharingConfigSchema.parse({}).disclosureRetentionYears;

    const features = config.features as unknown as Record<string, boolean>;

    return {
      configRecipients: fromConfig.map((r) => toView(r, 'config')),
      storedRecipients: stored.map((r) => toView(r, 'database')),
      configError,
      droppedConfigEntries,
      purposes,
      offeredPurposes: [...offered],
      scopeDigest: scope.digest,
      policyVersion: scope.policyVersion,
      maxStoredRecipients: MAX_STORED_RECIPIENTS,
      disclosureRetentionYears: retentionYears,
      flags: {
        dataSharingConsents: features.dataSharingConsents === true,
        memberDirectory: features.memberDirectory === true,
      },
    };
  },
);
