import type { PersonaField, PersonaSection } from '@commonpub/persona';
import { personaFieldSink } from '@commonpub/persona';
import { bandPersonaCount } from './metrics.js';

/**
 * The destructive-change analysis behind `PUT /api/admin/persona/schema`.
 *
 * It lives here, not in the route, for the reason `diffPersonaSchema` lives in
 * the registry: it is a pure comparison of two `PersonaSection[]` plus two count
 * maps, there is no HTTP in it, and in the route it could only be tested through
 * a 193-line Nitro stub harness while a fork could not reuse it at all. The
 * route's job is to gather the counts, call this, and map blockers to status
 * codes.
 *
 * NOTHING here deletes data. Removal is always an explicit operator decision
 * applied after the schema is persisted (plan 4.6), so a failed save can never
 * leave purged rows behind for a field that is still in the template.
 */

export type PersonaSchemaBlockerKind =
  | 'field_removed'
  | 'type_changed'
  | 'column_changed'
  | 'sensitivity_changed'
  | 'sink_changed'
  | 'option_removed';

export interface PersonaSchemaBlocker {
  fieldKey: string;
  kind: PersonaSchemaBlockerKind;
  detail: string;
  /**
   * K-ANONYMISED, exactly like `PersonaSchemaDrift.affectedRows`. This crosses
   * an HTTP boundary to a `settings.manage` holder, and the same request is a
   * pure read that writes nothing, so an un-floored figure here is a differencing
   * oracle: PUT the identical document with one option removed, read the count,
   * repeat per option, and the whole distribution falls out. It also counts
   * answers from members who explicitly REVOKED `profile_analytics`, for whom
   * there is no lawful basis to process at all.
   */
  affectedRows: number;
  /** True when the real count fell below the floor and `affectedRows` is 0. */
  affectedRowsBanded: boolean;
  /** `force` clears it via `?force=true`; `removal` needs a purge/retain decision. */
  requires: 'force' | 'removal';
}

export interface PersonaSchemaChangePlan {
  blockers: PersonaSchemaBlocker[];
  /**
   * Keys whose stored rows need an operator decision.
   *
   * ONLY keys genuinely absent from the new document. A `sink_changed` key is
   * NOT here: it is still in the schema, and running `retirePersonaField` on it
   * writes it into `persona.retiredFields`, which means "this field left the
   * schema" and is a permanent block in `listPersonaAggregatableFields`. An
   * operator toggling `analytics` off and on again would have retired the field
   * forever, with the only way back being to delete every member's answers.
   */
  removalNeeded: string[];
}

/** Flatten a template to `fieldKey -> field`. Keys are template-wide unique. */
export function flattenPersonaFields(
  sections: readonly PersonaSection[],
): Map<string, PersonaField> {
  const out = new Map<string, PersonaField>();
  for (const section of sections) {
    for (const field of section.fields) out.set(field.key, field);
  }
  return out;
}

/**
 * Keys whose stored rows could be affected by this save.
 *
 * Only keys that actually changed or vanished, so a routine label edit does not
 * issue a COUNT per field on every save.
 */
export function personaSchemaChangeCandidates(
  before: ReadonlyMap<string, PersonaField>,
  after: ReadonlyMap<string, PersonaField>,
): string[] {
  const candidates = new Set<string>();
  for (const [key, field] of before) {
    const replacement = after.get(key);
    if (replacement === undefined) {
      candidates.add(key);
      continue;
    }
    if (
      replacement.type !== field.type
      || replacement.column !== field.column
      || (replacement.sensitive === true) !== (field.sensitive === true)
      || personaFieldSink(replacement) !== personaFieldSink(field)
    ) {
      candidates.add(key);
      continue;
    }
    const newValues = new Set((replacement.options ?? []).map((o) => o.value));
    for (const option of field.options ?? []) {
      if (!newValues.has(option.value)) {
        candidates.add(key);
        break;
      }
    }
  }
  return [...candidates];
}

export interface PlanPersonaSchemaChangeInput {
  before: ReadonlyMap<string, PersonaField>;
  after: ReadonlyMap<string, PersonaField>;
  /** fieldKey -> total stored rows. Raw; banded on the way out. */
  rowCounts: ReadonlyMap<string, number>;
  /** fieldKey -> option value -> stored rows. Raw; never echoed per option. */
  optionCounts: ReadonlyMap<string, Record<string, number>>;
  /** The operator's purge/retain decisions, keyed by field key. */
  removal: Readonly<Record<string, 'purge' | 'retain' | undefined>>;
  /** Bucket floor for every count that leaves this function. */
  minBucket: number;
}

export function planPersonaSchemaChange(
  input: PlanPersonaSchemaChangeInput,
): PersonaSchemaChangePlan {
  const { before, after, rowCounts, optionCounts, removal, minBucket } = input;
  const blockers: PersonaSchemaBlocker[] = [];
  const removalNeeded: string[] = [];

  for (const key of personaSchemaChangeCandidates(before, after)) {
    const rows = rowCounts.get(key) ?? 0;
    // A field with no stored rows orphans nothing. Changing it freely is the
    // whole reason the key lock only bites once answers exist (plan 5.5).
    if (rows === 0) continue;

    const field = before.get(key);
    if (field === undefined) continue;
    const replacement = after.get(key);
    const band = bandPersonaCount(rows, minBucket);

    if (replacement === undefined) {
      removalNeeded.push(key);
      if (removal[key] === undefined) {
        blockers.push({
          fieldKey: key,
          kind: 'field_removed',
          detail: `Removing "${field.label}" orphans ${band.phrase} stored answers. Choose purge or retain.`,
          affectedRows: band.value,
          affectedRowsBanded: band.banded,
          requires: 'removal',
        });
      }
      continue;
    }

    if (replacement.type !== field.type) {
      blockers.push({
        fieldKey: key,
        kind: 'type_changed',
        detail: `Changing the type of "${field.label}" from ${field.type} to ${replacement.type} discards ${band.phrase} stored answers.`,
        affectedRows: band.value,
        affectedRowsBanded: band.banded,
        requires: 'force',
      });
    }
    if (replacement.column !== field.column) {
      blockers.push({
        fieldKey: key,
        kind: 'column_changed',
        detail: `Rebinding "${field.label}" to a different profile column strands ${band.phrase} stored answers.`,
        affectedRows: band.value,
        affectedRowsBanded: band.banded,
        requires: 'force',
      });
    }
    if ((replacement.sensitive === true) !== (field.sensitive === true)) {
      blockers.push({
        fieldKey: key,
        kind: 'sensitivity_changed',
        detail: `Changing the sensitivity of "${field.label}" moves it between storage sinks; ${band.phrase} stored answers stay where they are.`,
        affectedRows: band.value,
        affectedRowsBanded: band.banded,
        requires: 'force',
      });
    }

    const oldSink = personaFieldSink(field);
    const newSink = personaFieldSink(replacement);
    if (oldSink !== newSink) {
      // The rows stay in the OLD table. `getPersonaValues` surfaces them to the
      // member as `reason: 'sink_changed'` so they remain visible and erasable,
      // and the drift reconciler keeps telling the operator until they act.
      // This is `force`, never `removal`: the field is still in the schema, so
      // there is nothing to retire.
      blockers.push({
        fieldKey: key,
        kind: 'sink_changed',
        detail: `"${field.label}" moves from the ${oldSink} store to the ${newSink} store; its ${band.phrase} stored rows do not move with it and stay visible to each member as retired data.`,
        affectedRows: band.value,
        affectedRowsBanded: band.banded,
        requires: 'force',
      });
    } else {
      const newValues = new Set((replacement.options ?? []).map((o) => o.value));
      const byOption = optionCounts.get(key) ?? {};
      const dropped = (field.options ?? [])
        .map((o) => o.value)
        .filter((value) => !newValues.has(value));
      // Only the options somebody actually chose. Dropping an option with zero
      // stored answers orphans nothing, and demanding `?force=true` for it
      // teaches an operator that force is routine.
      const answered = dropped.filter((value) => (byOption[value] ?? 0) > 0);
      const orphaned = answered.reduce((sum, value) => sum + (byOption[value] ?? 0), 0);
      if (answered.length > 0) {
        const orphanBand = bandPersonaCount(orphaned, minBucket);
        // The dropped option VALUES are deliberately NOT named. Naming them
        // turns each refusal into one bit of a distribution the metrics module
        // refuses to publish, and eighteen refusals into the whole field.
        blockers.push({
          fieldKey: key,
          kind: 'option_removed',
          detail: `Removing ${answered.length} answered ${answered.length === 1 ? 'option' : 'options'} from "${field.label}" discards ${orphanBand.phrase} stored answers.`,
          affectedRows: orphanBand.value,
          affectedRowsBanded: orphanBand.banded,
          requires: 'force',
        });
      }
    }
  }

  return { blockers, removalNeeded };
}
