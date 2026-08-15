import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import {
  auditLogs,
  userPersonaAnswers,
  userPersonaText,
  userSharedLinks,
  users,
} from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import {
  PERSONA_CHECKBOX_FALSE,
  PERSONA_CHECKBOX_TRUE,
  PERSONA_CHECKBOX_VALUE,
  type PersonaAnswerMap,
  type PersonaField,
  type PersonaFieldSink,
  type PersonaLinkPlatformSpec,
  type PersonaSection,
  type UserBridgeColumn,
  findLinkPlatform,
  linkUrlMatchesPlatform,
  optionalUrl,
  personaFieldSink,
  personaFieldSpec,
} from '@commonpub/persona';
import type { DB } from '../types.js';
import { updateUserProfile } from '../profile/profile.js';
import {
  clearPersonaFieldRetired,
  effectivePersonaLinkPlatforms,
  effectivePersonaSchema,
  getPersonaRetiredFields,
  invalidatePersonaSchemaCache,
  setPersonaFieldRetired,
} from './registry.js';

/**
 * Persona answer storage (plan sections 4.5 and 4.6).
 *
 * Every value is routed by `personaFieldSink()` from `@commonpub/persona`, which
 * is THE partition predicate. Nothing in this file re-derives it: a hand-mirrored
 * copy of a storage rule is how a free-text answer ends up in the countable
 * table.
 *
 * The `column:`-bound fields and the `link` fields both funnel through the
 * existing `updateUserProfile`, so that function stays the ONLY writer of `users`
 * columns and of `users.social_links`. There is no `user_profile_links` table in
 * v1 and this file must never grow one (plan 14.4).
 *
 * `user_shared_links`, written at the foot of this file, is NOT that table and
 * the distinction is the whole reason it is safe to add. It holds no addresses:
 * one row per (member, platform key) recording that the member agreed to hand
 * that platform to the named recipients. The URL stays in `users.social_links`
 * with its single writer, so revoking a share never rewrites a link and editing
 * a link never touches a sharing decision.
 */

/**
 * Re-exported, never redeclared. The canonical checkbox vocabulary belongs with
 * `personaFieldSink` in `@commonpub/persona` because three surfaces speak it and
 * the one that cannot import this file (`PersonaFieldInput.vue`) is the one that
 * decides whether a saved box renders ticked.
 */
export { PERSONA_CHECKBOX_VALUE };

const CHECKBOX_TRUE = PERSONA_CHECKBOX_TRUE;
const CHECKBOX_FALSE = PERSONA_CHECKBOX_FALSE;

/**
 * Hard per-column caps, so a template with a generous `maxLength` cannot make a
 * `varchar` write throw. The template cap still applies when it is smaller.
 */
const COLUMN_MAX_LENGTH: Record<UserBridgeColumn, number> = {
  displayName: 128,
  bio: 2000,
  headline: 255,
  location: 128,
  pronouns: 32,
};

/** Default cap for a free-text field whose template declares no `maxLength`. */
const DEFAULT_TEXT_MAX_LENGTH = 2000;
/** `users.social_links` values and persona `url` answers share this cap. */
const LINK_MAX_LENGTH = 512;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

const AUDIT_ACTIONS = {
  purge: 'persona.field.purge',
  retain: 'persona.field.retain',
} as const;

// --- Read -----------------------------------------------------------------------

/**
 * Answers the member can still see, correct and erase, but which no live field
 * reads back (plan 4.6).
 *
 * TWO causes, not one. The obvious one is a field the operator removed. The
 * quiet one is a field still IN the schema whose SINK moved: flipping
 * `sensitive: true` on a `select` (the Art. 9 escape hatch) or setting
 * `analytics: false` routes the field from `user_persona_answers` to
 * `user_persona_text`, and the existing rows do not move with it. Keying this
 * list on "the key left the schema" made those rows invisible on every
 * self-service surface AND un-erasable, because `DELETE /api/persona/retired/
 * [fieldKey]` requires the key to appear here. Art. 17 self-service failed on
 * precisely the field class where it matters most.
 */
export interface RetiredPersonaValues {
  fieldKey: string;
  /** Closed-vocabulary rows, raw stored values. No label resolves for them. */
  values: string[];
  /** The free-text row, when there is one. */
  text: string | null;
  /** ISO date the field left the schema; null when the removal predates the record. */
  retiredAt: string | null;
  /** Why it is here. `sink_changed` keys are still questions the schema asks. */
  reason: RetiredPersonaReason;
}

/** Why a stored value is only reachable through the retired surface. */
export type RetiredPersonaReason = 'field_removed' | 'sink_changed';

export interface PersonaValues {
  /** `answers`-sink values, keyed by field key. A scalar select is a one-element array. */
  answers: Record<string, string[]>;
  /** `text`-sink values, keyed by field key. */
  text: Record<string, string>;
  /** `link`-sink values, keyed by FIELD key (stored under the platform's `social_links` key). */
  links: Record<string, string>;
  /** `column:`-bound values, keyed by field key. */
  columns: Record<string, string>;
  /** Data the user can still see, correct and erase after its question was removed. */
  retired: RetiredPersonaValues[];
}

function emptyValues(): PersonaValues {
  return { answers: {}, text: {}, links: {}, columns: {}, retired: [] };
}

/**
 * Everything one user has answered, partitioned exactly as it is stored.
 *
 * `sections` is passed in rather than resolved here so a caller that already
 * holds the effective schema (every route does) pays for one resolution, and so
 * this function is trivially testable against a hand-written template.
 */
export async function getPersonaValues(
  db: DB,
  userId: string,
  sections: readonly PersonaSection[],
): Promise<PersonaValues> {
  const [answerRows, textRows, userRows, retiredList] = await Promise.all([
    db
      .select({ fieldKey: userPersonaAnswers.fieldKey, value: userPersonaAnswers.value })
      .from(userPersonaAnswers)
      .where(eq(userPersonaAnswers.userId, userId))
      .orderBy(userPersonaAnswers.fieldKey, userPersonaAnswers.value),
    db
      .select({ fieldKey: userPersonaText.fieldKey, value: userPersonaText.value })
      .from(userPersonaText)
      .where(eq(userPersonaText.userId, userId)),
    db
      .select({
        displayName: users.displayName,
        bio: users.bio,
        headline: users.headline,
        location: users.location,
        pronouns: users.pronouns,
        socialLinks: users.socialLinks,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    getPersonaRetiredFields(db),
  ]);

  const out = emptyValues();
  const user = userRows[0];
  if (user === undefined) return out;

  const storedAnswers = new Map<string, string[]>();
  for (const row of answerRows) {
    const list = storedAnswers.get(row.fieldKey) ?? [];
    list.push(row.value);
    storedAnswers.set(row.fieldKey, list);
  }
  const storedText = new Map<string, string>();
  for (const row of textRows) storedText.set(row.fieldKey, row.value);

  const socialLinks: Record<string, string | undefined> = { ...(user.socialLinks ?? {}) };
  /** fieldKey -> the sink the LIVE schema reads for it. */
  const known = new Map<string, PersonaFieldSink>();

  for (const section of sections) {
    for (const field of section.fields) {
      const sink = personaFieldSink(field);
      known.set(field.key, sink);
      if (sink === 'answers') {
        const values = storedAnswers.get(field.key);
        if (values !== undefined) out.answers[field.key] = values;
      } else if (sink === 'text') {
        const value = storedText.get(field.key);
        if (value !== undefined) out.text[field.key] = value;
      } else if (sink === 'links') {
        const platform = field.platform;
        const url = platform === undefined ? undefined : socialLinks[platform];
        if (typeof url === 'string' && url !== '') out.links[field.key] = url;
      } else if (field.column !== undefined) {
        const value = user[field.column];
        if (typeof value === 'string' && value !== '') out.columns[field.key] = value;
      }
    }
  }

  const retiredAtByKey = new Map(retiredList.map((r) => [r.fieldKey, r.retiredAt]));
  const orphanKeys = new Set<string>([...storedAnswers.keys(), ...storedText.keys()]);
  for (const fieldKey of [...orphanKeys].sort()) {
    const liveSink = known.get(fieldKey);
    // A key still in the schema is NOT automatically served: what matters is
    // whether the table the rows live in is the one its current sink reads.
    if (liveSink !== undefined) {
      const strandedAnswers = liveSink !== 'answers' && storedAnswers.has(fieldKey);
      const strandedText = liveSink !== 'text' && storedText.has(fieldKey);
      if (!strandedAnswers && !strandedText) continue;
      out.retired.push({
        fieldKey,
        values: strandedAnswers ? (storedAnswers.get(fieldKey) ?? []) : [],
        text: strandedText ? (storedText.get(fieldKey) ?? null) : null,
        // A sink change is not a retirement date; the question is still asked.
        retiredAt: retiredAtByKey.get(fieldKey) ?? null,
        reason: 'sink_changed',
      });
      continue;
    }
    out.retired.push({
      fieldKey,
      values: storedAnswers.get(fieldKey) ?? [],
      text: storedText.get(fieldKey) ?? null,
      retiredAt: retiredAtByKey.get(fieldKey) ?? null,
      reason: 'field_removed',
    });
  }

  return out;
}

/**
 * Flatten stored values into the shape `personaCompleteness` takes.
 *
 * Column-bound and link fields count too: the profile IS section one of the
 * persona, so a filled display name is a filled persona field.
 */
export function personaAnswerMap(
  sections: readonly PersonaSection[],
  values: PersonaValues,
): PersonaAnswerMap {
  const map: Record<string, string | readonly string[] | null> = {};
  for (const section of sections) {
    for (const field of section.fields) {
      const sink = personaFieldSink(field);
      if (sink === 'answers') map[field.key] = values.answers[field.key] ?? null;
      else if (sink === 'text') map[field.key] = values.text[field.key] ?? null;
      else if (sink === 'links') map[field.key] = values.links[field.key] ?? null;
      else map[field.key] = values.columns[field.key] ?? null;
    }
  }
  return map;
}

// --- Validation (pure) ----------------------------------------------------------

/** What a client submits for one section. `null` and `''` both mean "cleared". */
export type PersonaSectionAnswers = Record<string, string | string[] | null>;

/**
 * A validated section submission, expressed as one entry per TEMPLATE field
 * rather than one per submitted key.
 *
 * That shape is the point (plan 4.5): the delete is scoped to the template, so
 * unchecking every box in a section actually clears it. Scoping from the payload
 * makes "uncheck everything" a no-op, which is a data-subject-rights bug wearing
 * an off-by-one costume.
 */
export interface NormalizedPersonaSection {
  columns: Array<{ fieldKey: string; column: UserBridgeColumn; value: string }>;
  links: Array<{ fieldKey: string; platform: string; url: string }>;
  answers: Array<{ fieldKey: string; values: string[] }>;
  text: Array<{ fieldKey: string; value: string }>;
}

export type PersonaValidationResult =
  | { ok: true; result: NormalizedPersonaSection }
  | { ok: false; error: string; fieldKey?: string };

function asScalar(raw: string | string[] | null | undefined): string | null {
  if (raw === null || raw === undefined) return '';
  if (Array.isArray(raw)) {
    if (raw.length === 0) return '';
    if (raw.length > 1) return null;
    return typeof raw[0] === 'string' ? raw[0] : null;
  }
  return raw;
}

function asList(raw: string | string[] | null | undefined): string[] | null {
  if (raw === null || raw === undefined) return [];
  if (typeof raw === 'string') return raw === '' ? [] : [raw];
  if (!Array.isArray(raw)) return null;
  for (const entry of raw) if (typeof entry !== 'string') return null;
  return raw.filter((v) => v !== '');
}

/**
 * Option-vocabulary validation, keyed on the field TYPE and never on its sink.
 *
 * `personaFieldSink` sends a `select` or `radio` to the FREE TEXT sink whenever
 * `sensitive` is true or `analytics` is false, which is exactly the Art. 9
 * escape hatch an operator reaches for on a health or ethnicity dropdown. Before
 * this existed the `text` branch validated only `maxLength`, so the closed
 * vocabulary the operator declared was enforced nowhere and any member could
 * store an arbitrary 2000-character string under it.
 *
 * Only the STORAGE DESTINATION may depend on the sink. What is a legal answer
 * depends on the question.
 */
function validateAgainstOptions(
  field: PersonaField,
  values: readonly string[],
): { ok: true } | { ok: false; error: string } {
  if (!personaFieldSpec(field.type).supportsOptions) return { ok: true };
  const allowed = new Set((field.options ?? []).map((o) => o.value));
  for (const value of values) {
    if (!allowed.has(value)) return { ok: false, error: `${field.label} does not offer that option` };
  }
  return { ok: true };
}

function validateFreeText(field: PersonaField, value: string): { ok: true; value: string } | { ok: false; error: string } {
  const cap = Math.min(field.maxLength ?? DEFAULT_TEXT_MAX_LENGTH, DEFAULT_TEXT_MAX_LENGTH);
  if (value.length > cap) {
    return { ok: false, error: `${field.label} is too long (maximum ${cap} characters)` };
  }
  if (field.type === 'url') {
    // Domain validation, not shape validation: a `javascript:` value is a string
    // of the right type and the wrong thing entirely.
    const parsed = optionalUrl(Math.min(cap, LINK_MAX_LENGTH)).safeParse(value);
    if (!parsed.success) return { ok: false, error: `${field.label} must be a valid http or https address` };
    return { ok: true, value: parsed.data ?? '' };
  }
  if (field.type === 'number' && !NUMBER_RE.test(value)) {
    return { ok: false, error: `${field.label} must be a number` };
  }
  if (field.type === 'date') {
    if (!DATE_RE.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) {
      return { ok: false, error: `${field.label} must be a date in YYYY-MM-DD form` };
    }
  }
  return { ok: true, value };
}

/**
 * Validate one section's submission against its template.
 *
 * Unknown field keys are rejected outright, which is the same rule
 * `validateSubmissionFields` applies to a contest submission: a payload cannot
 * smuggle values for a field the template does not declare, and it cannot reach
 * into another section either.
 */
export function validatePersonaSectionAnswers(
  section: PersonaSection,
  submitted: PersonaSectionAnswers,
  platforms: readonly PersonaLinkPlatformSpec[],
): PersonaValidationResult {
  const byKey = new Map(section.fields.map((f) => [f.key, f]));
  for (const key of Object.keys(submitted)) {
    if (!byKey.has(key)) return { ok: false, error: `Unknown field: ${key}`, fieldKey: key };
  }

  const result: NormalizedPersonaSection = { columns: [], links: [], answers: [], text: [] };

  for (const field of section.fields) {
    const spec = personaFieldSpec(field.type);
    // A heading carries no value. A stray value under its key is ignored rather
    // than rejected: it is a known key, and there is nothing to store.
    if (spec.cardinality === 'none' && field.column === undefined) continue;

    const sink = personaFieldSink(field);
    const raw = submitted[field.key];

    if (sink === 'none') {
      const column = field.column;
      if (column === undefined) continue;
      const scalar = asScalar(raw);
      if (scalar === null) return { ok: false, error: `${field.label} takes a single value`, fieldKey: field.key };
      const value = scalar.trim();
      const cap = Math.min(field.maxLength ?? COLUMN_MAX_LENGTH[column], COLUMN_MAX_LENGTH[column]);
      if (value.length > cap) {
        return { ok: false, error: `${field.label} is too long (maximum ${cap} characters)`, fieldKey: field.key };
      }
      result.columns.push({ fieldKey: field.key, column, value });
      continue;
    }

    if (sink === 'links') {
      const platformKey = field.platform;
      if (platformKey === undefined) {
        return { ok: false, error: `${field.label} has no platform`, fieldKey: field.key };
      }
      const platform = findLinkPlatform(platforms, platformKey);
      if (platform === undefined) {
        return { ok: false, error: `${field.label} uses an unknown platform`, fieldKey: field.key };
      }
      const scalar = asScalar(raw);
      if (scalar === null) return { ok: false, error: `${field.label} takes a single value`, fieldKey: field.key };
      const trimmed = scalar.trim();
      if (trimmed === '') {
        result.links.push({ fieldKey: field.key, platform: platformKey, url: '' });
        continue;
      }
      const parsed = optionalUrl(LINK_MAX_LENGTH).safeParse(trimmed);
      if (!parsed.success || parsed.data === undefined) {
        return { ok: false, error: `${field.label} must be a valid http or https address`, fieldKey: field.key };
      }
      if (!linkUrlMatchesPlatform(parsed.data, platform)) {
        return { ok: false, error: `${field.label} must be a link on ${platform.label}`, fieldKey: field.key };
      }
      result.links.push({ fieldKey: field.key, platform: platformKey, url: parsed.data });
      continue;
    }

    if (sink === 'text') {
      const scalar = asScalar(raw);
      if (scalar === null) return { ok: false, error: `${field.label} takes a single value`, fieldKey: field.key };
      const trimmed = scalar.trim();
      if (trimmed === '') {
        result.text.push({ fieldKey: field.key, value: '' });
        continue;
      }
      // A CLOSED-VOCABULARY field lands here whenever it is sensitive or opted
      // out of analytics. The vocabulary is a property of the question, so it
      // binds here too; only the destination table follows the sink.
      const vocabulary = validateAgainstOptions(field, [trimmed]);
      if (!vocabulary.ok) return { ok: false, error: vocabulary.error, fieldKey: field.key };
      const checked = validateFreeText(field, trimmed);
      if (!checked.ok) return { ok: false, error: checked.error, fieldKey: field.key };
      result.text.push({ fieldKey: field.key, value: checked.value });
      continue;
    }

    // sink === 'answers'
    if (field.type === 'checkbox') {
      const scalar = asScalar(raw);
      if (scalar === null) return { ok: false, error: `${field.label} takes a single value`, fieldKey: field.key };
      const normalized = scalar.trim().toLowerCase();
      if (CHECKBOX_TRUE.has(normalized)) {
        result.answers.push({ fieldKey: field.key, values: [PERSONA_CHECKBOX_VALUE] });
      } else if (CHECKBOX_FALSE.has(normalized)) {
        result.answers.push({ fieldKey: field.key, values: [] });
      } else {
        return { ok: false, error: `${field.label} must be ticked or not`, fieldKey: field.key };
      }
      continue;
    }

    const list = asList(raw);
    if (list === null) return { ok: false, error: `${field.label} has an invalid value`, fieldKey: field.key };
    const unique = [...new Set(list.map((v) => v.trim()))].filter((v) => v !== '');
    const vocabulary = validateAgainstOptions(field, unique);
    if (!vocabulary.ok) return { ok: false, error: vocabulary.error, fieldKey: field.key };
    if (spec.cardinality === 'scalar' && unique.length > 1) {
      return { ok: false, error: `${field.label} takes a single value`, fieldKey: field.key };
    }
    const cap = field.maxSelections ?? unique.length;
    if (unique.length > cap) {
      return { ok: false, error: `${field.label} takes at most ${cap} choices`, fieldKey: field.key };
    }
    result.answers.push({ fieldKey: field.key, values: unique });
  }

  return { ok: true, result };
}

// --- Write ----------------------------------------------------------------------

export interface SetPersonaSectionArgs {
  userId: string;
  sectionKey: string;
  answers: PersonaSectionAnswers;
  /**
   * Needed to resolve the effective schema, which is what makes the delete
   * template-scoped. The signature in plan 4.5 omits it because the plan wrote
   * the route; the resolution lives in `@commonpub/server`, never in a fork's
   * `server/utils/config.ts`.
   */
  config: CommonPubConfig;
}

export type SetPersonaSectionResult =
  | { ok: true; values: PersonaValues }
  | { ok: false; error: string; fieldKey?: string };

/**
 * Write ONE section, in ONE transaction (plan 4.5).
 *
 * Order inside the transaction: the profile bridge first (so a rejected column
 * value fails before any persona row moves), then the template-scoped clear and
 * re-insert of the persona tables. Appendix B13: the template-scoped clearing
 * applies to `user_persona_text` and to the profile links as well, not only to
 * `user_persona_answers`, or clearing a text field silently leaves the old value
 * and the Art. 16 argument this whole section makes for itself fails.
 */
export async function setPersonaSection(
  db: DB,
  args: SetPersonaSectionArgs,
): Promise<SetPersonaSectionResult> {
  const { userId, sectionKey, answers, config } = args;
  const { sections } = await effectivePersonaSchema(db, config);
  const section = sections.find((s) => s.key === sectionKey);
  if (section === undefined) return { ok: false, error: `Unknown section: ${sectionKey}` };

  const platforms = await effectivePersonaLinkPlatforms(db, config);
  const validated = validatePersonaSectionAnswers(section, answers, platforms);
  if (!validated.ok) return validated;
  const { columns, links, answers: answerFields, text: textFields } = validated.result;

  await db.transaction(async (tx) => {
    // SERIALISE this user's section writes against each other.
    //
    // The template-scoped clear is `DELETE ... WHERE value NOT IN (...)`, and a
    // DELETE under READ COMMITTED only re-evaluates rows it has already scanned:
    // it cannot see a row another transaction inserted after its snapshot. Two
    // tabs saving `{b}` and `{c}` over `{a}` therefore leave `{b, c}`, a set the
    // member never chose, which also inflates their contribution to two
    // analytics buckets. The unique index makes that non-crashing, which is why
    // it is silent. One row lock, taken before anything is read, orders the two.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update').limit(1);

    if (columns.length > 0 || links.length > 0) {
      const profileInput: Parameters<typeof updateUserProfile>[2] = {};
      for (const entry of columns) profileInput[entry.column] = entry.value;

      if (links.length > 0) {
        // Merge, never clobber: `updateUserProfile` writes the whole jsonb object,
        // and this section's template only speaks for its own platforms.
        const [row] = await tx
          .select({ socialLinks: users.socialLinks })
          .from(users)
          .where(eq(users.id, userId))
          .for('update')
          .limit(1);
        const merged: Record<string, string | undefined> = { ...(row?.socialLinks ?? {}) };
        for (const link of links) {
          if (link.url === '') delete merged[link.platform];
          else merged[link.platform] = link.url;
        }
        profileInput.socialLinks = merged;
      }

      await updateUserProfile(tx, userId, profileInput);
    }

    for (const field of answerFields) {
      // TEMPLATE-scoped delete. `notInArray` is guarded against an empty array,
      // which in Postgres would be `value NOT IN ()` and match nothing.
      await tx.delete(userPersonaAnswers).where(
        field.values.length > 0
          ? and(
            eq(userPersonaAnswers.userId, userId),
            eq(userPersonaAnswers.fieldKey, field.fieldKey),
            notInArray(userPersonaAnswers.value, field.values),
          )
          : and(
            eq(userPersonaAnswers.userId, userId),
            eq(userPersonaAnswers.fieldKey, field.fieldKey),
          ),
      );
      if (field.values.length === 0) continue;
      await tx
        .insert(userPersonaAnswers)
        .values(field.values.map((value) => ({
          userId,
          sectionKey: section.key,
          fieldKey: field.fieldKey,
          value,
        })))
        .onConflictDoUpdate({
          target: [userPersonaAnswers.userId, userPersonaAnswers.fieldKey, userPersonaAnswers.value],
          set: { sectionKey: section.key },
        });
    }

    for (const field of textFields) {
      if (field.value === '') {
        await tx.delete(userPersonaText).where(and(
          eq(userPersonaText.userId, userId),
          eq(userPersonaText.fieldKey, field.fieldKey),
        ));
        continue;
      }
      await tx
        .insert(userPersonaText)
        .values({
          userId,
          sectionKey: section.key,
          fieldKey: field.fieldKey,
          value: field.value,
        })
        .onConflictDoUpdate({
          target: [userPersonaText.userId, userPersonaText.fieldKey],
          set: { sectionKey: section.key, value: field.value, updatedAt: new Date() },
        });
    }
  });

  return { ok: true, values: await getPersonaValues(db, userId, sections) };
}

// --- Per-platform link sharing (plan R3.1 D6) -----------------------------------

/**
 * The member's per-platform link sharing choices.
 *
 * ROW PRESENT MEANS SHARED. There is no state column and no default value, so
 * "not shared" is the absence of a row and the default is off by construction:
 * a member who has never opened the control shares nothing, and no migration can
 * turn that into sharing by editing a default. Reading is therefore just the
 * list of platform keys, sorted so a settings form renders the same order twice.
 *
 * A key here can name a platform the operator has since removed from the
 * registry. It is returned rather than filtered, because this is the member's
 * record of what they agreed to and hiding a row they cannot then untick is how
 * a control quietly stops meaning anything. Every surface that DISCLOSES a link
 * intersects this list with the effective platforms anyway.
 */
export async function listSharedLinkPlatforms(db: DB, userId: string): Promise<string[]> {
  const rows = await db
    .select({ platform: userSharedLinks.platform })
    .from(userSharedLinks)
    .where(eq(userSharedLinks.userId, userId))
    .orderBy(userSharedLinks.platform);
  return rows.map((r) => r.platform);
}

export interface SetSharedLinkPlatformsArgs {
  userId: string;
  /** The platforms the member chooses to share. An empty list clears them all. */
  platforms: readonly string[];
  /**
   * Needed to resolve the EFFECTIVE platform list, which is what makes the
   * delete template-scoped and what an unknown key is validated against. Same
   * reason {@link SetPersonaSectionArgs} carries it: the resolution lives in
   * `@commonpub/server`, never in a fork's `server/utils/config.ts`.
   */
  config: CommonPubConfig;
}

export type SetSharedLinkPlatformsResult =
  | { ok: true; platforms: string[] }
  | { ok: false; error: string; platform?: string };

/**
 * Replace the member's sharing choices, in ONE transaction.
 *
 * TEMPLATE-SCOPED DELETE, for exactly the reason {@link setPersonaSection}
 * scopes its delete to the section's fields rather than to the submitted keys:
 * scoping from the payload makes "untick everything" a no-op, which is a
 * data-subject-rights bug wearing an off-by-one costume. Here the scope is the
 * effective platform list, so an empty submission really does clear every
 * platform the member was shown, and a row for a platform the operator has since
 * retired is left alone rather than silently revoked by a form that never
 * offered it.
 *
 * VALIDATE THE DOMAIN, NOT THE SHAPE. An unknown platform key is a rejection
 * here and never reaches a bind, the same rule the directory filters and the
 * persona answers both follow.
 *
 * The row lock is taken for the same reason it is in `setPersonaSection`: the
 * delete is `NOT IN (...)`, which under READ COMMITTED cannot see a row a
 * concurrent transaction inserted after its snapshot, so two tabs saving
 * different sets would otherwise leave their union, a set the member never
 * chose, and here that union is a disclosure.
 */
export async function setSharedLinkPlatforms(
  db: DB,
  args: SetSharedLinkPlatformsArgs,
): Promise<SetSharedLinkPlatformsResult> {
  const { userId, config } = args;
  const platforms = await effectivePersonaLinkPlatforms(db, config);
  const templateKeys = platforms.map((p) => p.key);

  const chosen = [...new Set(args.platforms.map((p) => p.trim()).filter((p) => p !== ''))].sort();
  for (const key of chosen) {
    if (findLinkPlatform(platforms, key) === undefined) {
      return { ok: false, error: `"${key}" is not a link platform on this instance`, platform: key };
    }
  }

  await db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update').limit(1);

    // `inArray`/`notInArray` with an empty list is `IN ()`, which is not valid
    // SQL, so each branch is guarded rather than relying on the template never
    // being empty. An instance with no platforms at all has nothing to clear.
    if (templateKeys.length > 0) {
      await tx.delete(userSharedLinks).where(
        chosen.length > 0
          ? and(
            eq(userSharedLinks.userId, userId),
            inArray(userSharedLinks.platform, templateKeys),
            notInArray(userSharedLinks.platform, chosen),
          )
          : and(
            eq(userSharedLinks.userId, userId),
            inArray(userSharedLinks.platform, templateKeys),
          ),
      );
    }

    if (chosen.length > 0) {
      // `onConflictDoNothing`, never an upsert: re-ticking a box a member has
      // already ticked is not a new decision, and rewriting `created_at` would
      // erase when they actually made it.
      await tx
        .insert(userSharedLinks)
        .values(chosen.map((platform) => ({ userId, platform })))
        .onConflictDoNothing({
          target: [userSharedLinks.userId, userSharedLinks.platform],
        });
    }
  });

  return { ok: true, platforms: await listSharedLinkPlatforms(db, userId) };
}

// --- Retired-field handling (plan 4.6) ------------------------------------------

/**
 * A user deleting their own data for one field key.
 *
 * Allowed for ANY key, including one still in the schema: erasure is the data
 * subject's right, not a function of whether the operator still asks the
 * question. This is the control behind "This was collected under a question that
 * is no longer part of this profile. You can delete it."
 */
export async function deletePersonaFieldValue(
  db: DB,
  args: { userId: string; fieldKey: string },
): Promise<{ deleted: number }> {
  const { userId, fieldKey } = args;
  let deleted = 0;
  await db.transaction(async (tx) => {
    const answers = await tx
      .delete(userPersonaAnswers)
      .where(and(eq(userPersonaAnswers.userId, userId), eq(userPersonaAnswers.fieldKey, fieldKey)))
      .returning({ id: userPersonaAnswers.id });
    const text = await tx
      .delete(userPersonaText)
      .where(and(eq(userPersonaText.userId, userId), eq(userPersonaText.fieldKey, fieldKey)))
      .returning({ id: userPersonaText.id });
    deleted = answers.length + text.length;
  });
  return { deleted };
}

/** How many rows exist for a field key, across every user. */
export async function countPersonaFieldRows(db: DB, fieldKey: string): Promise<number> {
  const [answers, text] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userPersonaAnswers)
      .where(eq(userPersonaAnswers.fieldKey, fieldKey)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userPersonaText)
      .where(eq(userPersonaText.fieldKey, fieldKey)),
  ]);
  return (answers[0]?.count ?? 0) + (text[0]?.count ?? 0);
}

/**
 * Stored rows per OPTION VALUE for one field.
 *
 * The admin schema editor needs this to decide whether dropping an option is
 * destructive. With only the whole-field count from
 * {@link countPersonaFieldRows} it has to demand `?force=true` for ANY option
 * removal on a field that has answers, even when nobody ever picked the option
 * being dropped: safe, but it trains an operator to tick force, which is
 * exactly what force must not become.
 *
 * Scoped to one field rather than exposing the whole-table loader the registry
 * uses for drift, because a schema edit asks about the field in front of the
 * operator and should not scan every answer on the instance to answer it.
 *
 * Only `user_persona_answers` has option values; free text has no vocabulary.
 */
export async function countPersonaFieldOptionRows(
  db: DB,
  fieldKey: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({ value: userPersonaAnswers.value, count: sql<number>`count(*)::int` })
    .from(userPersonaAnswers)
    .where(eq(userPersonaAnswers.fieldKey, fieldKey))
    .groupBy(userPersonaAnswers.value);

  const out: Record<string, number> = {};
  for (const row of rows) out[row.value] = row.count;
  return out;
}

/**
 * PURGE: delete every stored row for a removed field, in one transaction, and
 * record the count in `audit_logs` (plan 4.6).
 */
export async function purgePersonaField(
  db: DB,
  args: { fieldKey: string; adminId: string; ip?: string | null },
): Promise<{ deleted: number }> {
  const { fieldKey, adminId, ip } = args;
  let deleted = 0;
  // ONE transaction for all three writes. Split across two, a process killed in
  // the gap leaves the rows gone and the key still in `persona.retiredFields`,
  // so re-adding the field later is permanently excluded from
  // `listPersonaAggregatableFields` with no data left to justify it.
  await db.transaction(async (tx) => {
    const answers = await tx
      .delete(userPersonaAnswers)
      .where(eq(userPersonaAnswers.fieldKey, fieldKey))
      .returning({ id: userPersonaAnswers.id });
    const text = await tx
      .delete(userPersonaText)
      .where(eq(userPersonaText.fieldKey, fieldKey))
      .returning({ id: userPersonaText.id });
    deleted = answers.length + text.length;
    await tx.insert(auditLogs).values({
      userId: adminId,
      action: AUDIT_ACTIONS.purge,
      targetType: 'persona_field',
      targetId: fieldKey,
      metadata: { deleted },
      ipAddress: ip ?? null,
    });
    // Nothing is left to keep, so the key leaves the retained list too.
    await clearPersonaFieldRetired(tx, fieldKey, adminId);
  });
  invalidatePersonaSchemaCache(db);
  return { deleted };
}

/**
 * RETAIN: keep the rows, record the field key as retired with the date it left
 * the schema, and record the count in `audit_logs` (plan 4.6).
 *
 * Retained keys are excluded from `listPersonaAggregatableFields`, so nothing
 * keeps counting a question the operator withdrew, and they surface in
 * `getPersonaValues().retired` so the user can still see and erase them.
 */
export async function retirePersonaField(
  db: DB,
  args: { fieldKey: string; adminId: string; ip?: string | null },
): Promise<{ retained: number; retiredAt: Date }> {
  const { fieldKey, adminId, ip } = args;
  const retiredAt = new Date();
  let retained = 0;
  // The audit row is the ONE thing that records who withdrew a question and how
  // much data it left behind, so it cannot be a separate write that a crash can
  // drop while the retirement stands.
  await db.transaction(async (tx) => {
    retained = await countPersonaFieldRows(tx, fieldKey);
    await setPersonaFieldRetired(tx, fieldKey, adminId, retiredAt);
    await tx.insert(auditLogs).values({
      userId: adminId,
      action: AUDIT_ACTIONS.retain,
      targetType: 'persona_field',
      targetId: fieldKey,
      metadata: { retained, retiredAt: retiredAt.toISOString() },
      ipAddress: ip ?? null,
    });
  });
  invalidatePersonaSchemaCache(db);
  return { retained, retiredAt };
}
