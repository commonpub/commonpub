import { describe, expect, it } from 'vitest';

import {
  PERSONA_CHECKBOX_FALSE,
  PERSONA_CHECKBOX_TRUE,
  PERSONA_CHECKBOX_VALUE,
  PERSONA_FIELD_SPECS,
  PERSONA_FIELD_TYPES,
  type PersonaFieldType,
  UnknownPersonaFieldTypeError,
  isPersonaFieldType,
  personaFieldSpec,
} from '../fields.js';
import { PERSONA_KEY_PATTERN } from '../schemas.js';

describe('the checkbox vocabulary', () => {
  /**
   * These constants live in this package, not beside the SQL, because
   * `PersonaFieldInput.vue` has to decide whether the box renders ticked and
   * cannot import `@commonpub/server`. When the canonical value lived there the
   * component hardcoded `'true'`, the write path normalised it to `'yes'`, and
   * a saved answer read back UNTICKED with every test still green.
   */
  it('accepts what a client sends and stores one canonical value', () => {
    expect(PERSONA_CHECKBOX_TRUE.has(PERSONA_CHECKBOX_VALUE)).toBe(true);
    expect(PERSONA_CHECKBOX_TRUE.has('true')).toBe(true);
    expect(PERSONA_CHECKBOX_FALSE.has('false')).toBe(true);
    expect(PERSONA_CHECKBOX_FALSE.has('')).toBe(true);
  });

  it('never treats one spelling as both ticked and unticked', () => {
    for (const value of PERSONA_CHECKBOX_TRUE) {
      expect(PERSONA_CHECKBOX_FALSE.has(value), value).toBe(false);
    }
  });

  it('stores a value that is a legal analytics dimension', () => {
    // The stored value becomes a `persona_metrics_daily.dimension`, so it has to
    // survive the same alphabet every option value does.
    expect(PERSONA_KEY_PATTERN.test(PERSONA_CHECKBOX_VALUE)).toBe(true);
  });
});

describe('PERSONA_FIELD_SPECS', () => {
  it('has exactly one spec per declared type, with a floor', () => {
    // The `satisfies` clause makes an omission a typecheck failure. This runtime
    // assertion catches a regression that reintroduces `as`, which would silence
    // the compiler. The floor catches a regression that empties the tuple.
    expect(Object.keys(PERSONA_FIELD_SPECS).sort()).toEqual([...PERSONA_FIELD_TYPES].sort());
    expect(PERSONA_FIELD_TYPES.length).toBeGreaterThanOrEqual(11);
    expect(Object.keys(PERSONA_FIELD_SPECS)).toHaveLength(PERSONA_FIELD_TYPES.length);
  });

  it('never marks a free-text type aggregatable', () => {
    // The structural guarantee: free text can never become a counted bucket, so
    // there is no setting anywhere that could turn a bio into statistics.
    for (const type of ['text', 'textarea', 'url', 'number', 'date'] as const) {
      expect(PERSONA_FIELD_SPECS[type].aggregatable, type).toBe(false);
      expect(PERSONA_FIELD_SPECS[type].sink, type).toBe('text');
    }
  });

  it('only lets closed-vocabulary types reach the answers sink', () => {
    for (const type of PERSONA_FIELD_TYPES) {
      const spec = PERSONA_FIELD_SPECS[type];
      if (spec.aggregatable) expect(spec.sink, type).toBe('answers');
      if (spec.sink === 'answers') {
        expect(spec.group, type).toBe('choice');
      }
    }
  });

  it('keeps maxLength on the types that actually take one', () => {
    // Appendix B14: the doc comment on PersonaField.maxLength tracks this, not
    // the other way round.
    const withMaxLength = PERSONA_FIELD_TYPES.filter(
      (t) => PERSONA_FIELD_SPECS[t].supportsMaxLength,
    );
    expect(withMaxLength).toEqual(['text', 'textarea', 'url']);
  });

  it('supports maxSelections only for the set-cardinality type', () => {
    const withMaxSelections = PERSONA_FIELD_TYPES.filter(
      (t) => PERSONA_FIELD_SPECS[t].supportsMaxSelections,
    );
    expect(withMaxSelections).toEqual(['multiselect']);
    expect(PERSONA_FIELD_SPECS.multiselect.cardinality).toBe('set');
  });
});

describe('personaFieldSpec', () => {
  it('returns the spec for a known type', () => {
    expect(personaFieldSpec('multiselect').label).toBe('Multiple choice grid');
  });

  it('fails CLOSED on a type that is not in the registry', () => {
    // Appendix B7. A stored template can carry a type a later release removed,
    // and the value read out of jsonb is a string whatever the compiler was
    // told. Dereferencing undefined here would surface three frames away, in a
    // function deciding where personal data gets stored.
    expect(() => personaFieldSpec('signature')).toThrow(UnknownPersonaFieldTypeError);
    expect(() => personaFieldSpec('')).toThrow(UnknownPersonaFieldTypeError);
    try {
      personaFieldSpec('file');
    } catch (err) {
      expect(err).toBeInstanceOf(UnknownPersonaFieldTypeError);
      expect((err as UnknownPersonaFieldTypeError).type).toBe('file');
    }
  });

  it('does not accept contest-only field types, because this taxonomy is its own', () => {
    // Section 14.4: the persona registry is deliberately not the contest form
    // registry. If these ever start resolving, someone has merged the two.
    for (const contestOnly of ['email', 'tel', 'agreement', 'address', 'file', 'signature']) {
      expect(isPersonaFieldType(contestOnly), contestOnly).toBe(false);
    }
  });

  it('narrows a valid type string', () => {
    const raw: string = 'select';
    expect(isPersonaFieldType(raw)).toBe(true);
    if (isPersonaFieldType(raw)) {
      const narrowed: PersonaFieldType = raw;
      expect(PERSONA_FIELD_SPECS[narrowed].supportsOptions).toBe(true);
    }
  });
});
