/**
 * The persona field-type registry.
 *
 * This is deliberately a PERSONA-ONLY taxonomy. It does not import from, extend,
 * or otherwise couple itself to the contest form engine
 * (`packages/schema/src/contest.ts`), and the contest engine must never import
 * this file. Section 14.4 of the plan: persona shares no behaviour with the
 * contest form engine (no `required`, no `pii`, its own renderer, its own
 * storage partition), so merging the two type unions would refactor a live
 * system in exchange for cosmetic unity. The overlap in type NAMES is a
 * coincidence of vocabulary, not a shared contract.
 */

/**
 * The ONE type tuple. `PersonaFieldType` derives from it, and so does every Zod
 * enum in this package, so there is no hand-mirrored union/array pair that can
 * drift.
 */
export const PERSONA_FIELD_TYPES = [
  'text',
  'textarea',
  'url',
  'number',
  'date',
  'select',
  'radio',
  'checkbox',
  'multiselect',
  'link',
  'section',
] as const;

export type PersonaFieldType = (typeof PERSONA_FIELD_TYPES)[number];

/**
 * Where an answer to a field of this type is stored.
 *
 * - `answers`: a closed-vocabulary selection, in `user_persona_answers`. The
 *   only sink that can ever become an aggregate bucket.
 * - `text`: free text, in `user_persona_text`. Never counted, ever.
 * - `links`: a profile link, written through the existing `users.social_links`.
 * - `none`: nothing is stored in the persona tables (a layout element, or a
 *   field bound to an existing `users` column).
 */
export type PersonaFieldSink = 'answers' | 'text' | 'links' | 'none';

export interface PersonaFieldTypeSpec {
  readonly label: string;
  readonly group: 'basic' | 'choice' | 'layout' | 'links';
  readonly cardinality: 'none' | 'scalar' | 'set';
  /**
   * Can an answer of this type ever become an aggregate bucket? FALSE for every
   * free-text type: that is the structural guarantee, not a policy setting.
   */
  readonly aggregatable: boolean;
  readonly supportsOptions: boolean;
  readonly supportsMaxLength: boolean;
  readonly supportsMaxSelections: boolean;
  readonly sink: PersonaFieldSink;
}

/**
 * `satisfies`, NOT `as`. A missing key is a typecheck failure, an excess key is
 * a typecheck failure, and the literal keeps its narrow inferred types. `as`
 * would suppress the very missing-key check the registry exists for.
 */
export const PERSONA_FIELD_SPECS = {
  text: {
    label: 'Short text',
    group: 'basic',
    cardinality: 'scalar',
    aggregatable: false,
    supportsOptions: false,
    supportsMaxLength: true,
    supportsMaxSelections: false,
    sink: 'text',
  },
  textarea: {
    label: 'Long text',
    group: 'basic',
    cardinality: 'scalar',
    aggregatable: false,
    supportsOptions: false,
    supportsMaxLength: true,
    supportsMaxSelections: false,
    sink: 'text',
  },
  url: {
    label: 'Web address',
    group: 'basic',
    cardinality: 'scalar',
    aggregatable: false,
    supportsOptions: false,
    supportsMaxLength: true,
    supportsMaxSelections: false,
    sink: 'text',
  },
  number: {
    label: 'Number',
    group: 'basic',
    cardinality: 'scalar',
    aggregatable: false,
    supportsOptions: false,
    supportsMaxLength: false,
    supportsMaxSelections: false,
    sink: 'text',
  },
  date: {
    label: 'Date',
    group: 'basic',
    cardinality: 'scalar',
    aggregatable: false,
    supportsOptions: false,
    supportsMaxLength: false,
    supportsMaxSelections: false,
    sink: 'text',
  },
  select: {
    label: 'Dropdown',
    group: 'choice',
    cardinality: 'scalar',
    aggregatable: true,
    supportsOptions: true,
    supportsMaxLength: false,
    supportsMaxSelections: false,
    sink: 'answers',
  },
  radio: {
    label: 'Single choice',
    group: 'choice',
    cardinality: 'scalar',
    aggregatable: true,
    supportsOptions: true,
    supportsMaxLength: false,
    supportsMaxSelections: false,
    sink: 'answers',
  },
  checkbox: {
    label: 'Single checkbox',
    group: 'choice',
    cardinality: 'scalar',
    aggregatable: true,
    supportsOptions: false,
    supportsMaxLength: false,
    supportsMaxSelections: false,
    sink: 'answers',
  },
  multiselect: {
    label: 'Multiple choice grid',
    group: 'choice',
    cardinality: 'set',
    aggregatable: true,
    supportsOptions: true,
    supportsMaxLength: false,
    supportsMaxSelections: true,
    sink: 'answers',
  },
  link: {
    // Presence of a link is counted separately, from the profile links, so the
    // link value itself is never an aggregate bucket.
    label: 'Profile link',
    group: 'links',
    cardinality: 'scalar',
    aggregatable: false,
    supportsOptions: false,
    supportsMaxLength: false,
    supportsMaxSelections: false,
    sink: 'links',
  },
  section: {
    label: 'Section heading',
    group: 'layout',
    cardinality: 'none',
    aggregatable: false,
    supportsOptions: false,
    supportsMaxLength: false,
    supportsMaxSelections: false,
    sink: 'none',
  },
} satisfies Record<PersonaFieldType, PersonaFieldTypeSpec>;

/**
 * The canonical stored value of a ticked `checkbox`, and the spellings a write
 * accepts for it.
 *
 * These live HERE, in the brain package, and not beside the query that writes
 * them. Three surfaces speak this vocabulary and none can import the others: the
 * write path normalises to it, the reader hands it back, and
 * `PersonaFieldInput.vue` has to decide whether the box renders ticked. When the
 * constant lived in `@commonpub/server` the component could not import it, so it
 * hardcoded `'true'`, the write path silently normalised that to `'yes'`, and a
 * saved answer read back UNTICKED. A value that decides what is stored belongs
 * with `personaFieldSink`, not with the SQL.
 */
export const PERSONA_CHECKBOX_VALUE = 'yes';

/** Every spelling a client may send for a ticked box. Normalised on write. */
export const PERSONA_CHECKBOX_TRUE: ReadonlySet<string> = new Set([
  PERSONA_CHECKBOX_VALUE,
  'true',
  '1',
  'on',
]);

/** Every spelling a client may send for an unticked box. Clears the answer. */
export const PERSONA_CHECKBOX_FALSE: ReadonlySet<string> = new Set([
  '',
  'no',
  'false',
  '0',
  'off',
]);

/**
 * Thrown when a field type that is not in the registry reaches a registry
 * lookup. Typed so a caller can tell "unknown persona field type" apart from a
 * generic `TypeError` and decide to fail closed.
 *
 * Appendix B7: the registry lookup must never dereference `undefined`. A stored
 * template can carry a type that a later release removed, and the value read
 * out of jsonb is `string`, not `PersonaFieldType`, whatever the compiler was
 * told. Throwing here is the fail-closed answer: a caller deciding storage or
 * disclosure cannot be allowed to silently treat an unknown type as harmless.
 */
export class UnknownPersonaFieldTypeError extends Error {
  public readonly type: string;

  constructor(type: string) {
    super(`Unknown persona field type: ${JSON.stringify(type)}`);
    this.name = 'UnknownPersonaFieldTypeError';
    this.type = type;
  }
}

/** True when `type` is a known persona field type. Narrowing, no throw. */
export function isPersonaFieldType(type: string): type is PersonaFieldType {
  return (PERSONA_FIELD_TYPES as readonly string[]).includes(type);
}

/**
 * THE registry lookup. Every read of `PERSONA_FIELD_SPECS` goes through this,
 * so an unknown type fails closed with a typed error instead of producing
 * `undefined` and a `TypeError` three frames further on.
 */
export function personaFieldSpec(type: string): PersonaFieldTypeSpec {
  if (!isPersonaFieldType(type)) throw new UnknownPersonaFieldTypeError(type);
  return PERSONA_FIELD_SPECS[type];
}
