import { describe, it, expect } from 'vitest';
import {
  visibleFormFieldKeys,
  isFormAcceptanceValue,
  isConditionSourceField,
  CONDITION_SOURCE_TYPES,
  type FormField,
} from '../contest';
import { registrationTemplateSchema } from '../validators/contest';

// Conditional form fields (P7). `visibleFormFieldKeys` is the single source of
// truth shared by the renderer, the client required-gate, the payload builder and
// the server's validate-and-partition, so these cases are the contract all four
// inherit. A divergence here is a field hidden on screen but demanded by the
// server, or demanded on screen and dropped by the server.

const f = (over: Partial<FormField> & Pick<FormField, 'key' | 'type'>): FormField => ({
  label: over.key,
  required: false,
  ...over,
});

const TRACK = f({
  key: 'track',
  type: 'select',
  options: [
    { value: 'developer', label: 'Developer' },
    { value: 'startup', label: 'Startup' },
  ],
});
const IS_ENTITY = f({ key: 'is_entity', type: 'checkbox' });

describe('visibleFormFieldKeys', () => {
  it('shows every field when nothing carries a condition', () => {
    const t = [TRACK, f({ key: 'a', type: 'text' }), f({ key: 'b', type: 'text' })];
    expect([...visibleFormFieldKeys(t, {})]).toEqual(['track', 'a', 'b']);
  });

  it('hides a conditional field until the source matches', () => {
    const t = [TRACK, f({ key: 'ein', type: 'text', showWhen: { field: 'track', equals: ['startup'] } })];
    expect(visibleFormFieldKeys(t, {}).has('ein')).toBe(false);
    expect(visibleFormFieldKeys(t, { track: 'developer' }).has('ein')).toBe(false);
    expect(visibleFormFieldKeys(t, { track: 'startup' }).has('ein')).toBe(true);
  });

  it('matches any of several values', () => {
    const t = [TRACK, f({ key: 'x', type: 'text', showWhen: { field: 'track', equals: ['developer', 'startup'] } })];
    expect(visibleFormFieldKeys(t, { track: 'developer' }).has('x')).toBe(true);
    expect(visibleFormFieldKeys(t, { track: 'startup' }).has('x')).toBe(true);
    expect(visibleFormFieldKeys(t, { track: 'other' }).has('x')).toBe(false);
  });

  it('trims the answer before comparing, so a padded value still matches', () => {
    const t = [TRACK, f({ key: 'x', type: 'text', showWhen: { field: 'track', equals: ['startup'] } })];
    expect(visibleFormFieldKeys(t, { track: '  startup  ' }).has('x')).toBe(true);
  });

  it('normalizes a checkbox source to true/false, whatever marker the client sent', () => {
    const t = [IS_ENTITY, f({ key: 'doc', type: 'file', showWhen: { field: 'is_entity', equals: ['true'] } })];
    for (const marker of ['true', 'on', '1', 'yes', 'checked', 'ACCEPTED']) {
      expect(visibleFormFieldKeys(t, { is_entity: marker }).has('doc')).toBe(true);
    }
    for (const marker of ['false', '', '0', 'no']) {
      expect(visibleFormFieldKeys(t, { is_entity: marker }).has('doc')).toBe(false);
    }
    expect(visibleFormFieldKeys(t, {}).has('doc')).toBe(false);
  });

  it('supports a condition on the UNCHECKED state', () => {
    const t = [IS_ENTITY, f({ key: 'why', type: 'text', showWhen: { field: 'is_entity', equals: ['false'] } })];
    expect(visibleFormFieldKeys(t, {}).has('why')).toBe(true);
    expect(visibleFormFieldKeys(t, { is_entity: 'true' }).has('why')).toBe(false);
  });

  it('gates a whole section: the header and every field down to the next section', () => {
    const t = [
      IS_ENTITY,
      f({ key: 'org', type: 'section', showWhen: { field: 'is_entity', equals: ['true'] } }),
      f({ key: 'org_name', type: 'text' }),
      f({ key: 'org_role', type: 'text' }),
      f({ key: 'project', type: 'section' }),
      f({ key: 'repo', type: 'url' }),
    ];
    const hidden = visibleFormFieldKeys(t, { is_entity: 'false' });
    expect([...hidden]).toEqual(['is_entity', 'project', 'repo']);

    const shown = visibleFormFieldKeys(t, { is_entity: 'true' });
    expect([...shown]).toEqual(['is_entity', 'org', 'org_name', 'org_role', 'project', 'repo']);
  });

  it('reopens the gate at an unconditional section', () => {
    const t = [
      IS_ENTITY,
      f({ key: 's1', type: 'section', showWhen: { field: 'is_entity', equals: ['true'] } }),
      f({ key: 'a', type: 'text' }),
      f({ key: 's2', type: 'section' }),
      f({ key: 'b', type: 'text' }),
    ];
    expect(visibleFormFieldKeys(t, {}).has('a')).toBe(false);
    expect(visibleFormFieldKeys(t, {}).has('b')).toBe(true);
  });

  it('ANDs a field condition with its section gate', () => {
    const t = [
      IS_ENTITY,
      TRACK,
      f({ key: 'sec', type: 'section', showWhen: { field: 'is_entity', equals: ['true'] } }),
      f({ key: 'both', type: 'text', showWhen: { field: 'track', equals: ['startup'] } }),
    ];
    expect(visibleFormFieldKeys(t, { is_entity: 'true', track: 'developer' }).has('both')).toBe(false);
    expect(visibleFormFieldKeys(t, { is_entity: 'false', track: 'startup' }).has('both')).toBe(false);
    expect(visibleFormFieldKeys(t, { is_entity: 'true', track: 'startup' }).has('both')).toBe(true);
  });

  it('cascades: a condition keyed on a HIDDEN field is never satisfied', () => {
    // `sub` depends on `mid`, which is itself hidden. Even with a matching answer
    // left over for `mid`, `sub` must stay hidden — otherwise a grandchild
    // outlives the parent that was supposed to gate it.
    const t = [
      IS_ENTITY,
      f({ key: 'mid', type: 'checkbox', showWhen: { field: 'is_entity', equals: ['true'] } }),
      f({ key: 'sub', type: 'text', showWhen: { field: 'mid', equals: ['true'] } }),
    ];
    expect(visibleFormFieldKeys(t, { is_entity: 'true', mid: 'true' }).has('sub')).toBe(true);
    expect(visibleFormFieldKeys(t, { is_entity: 'false', mid: 'true' }).has('sub')).toBe(false);
  });

  it('never matches a condition naming a missing field', () => {
    const t = [f({ key: 'x', type: 'text', showWhen: { field: 'nope', equals: ['true'] } })];
    expect(visibleFormFieldKeys(t, { nope: 'true' }).has('x')).toBe(false);
  });

  it('never matches a condition naming a LATER field', () => {
    // The validator rejects this on write; this is the read-side belt for a row
    // stored before the rule existed.
    const t = [f({ key: 'early', type: 'text', showWhen: { field: 'late', equals: ['a'] } }), TRACK, f({ key: 'late', type: 'select', options: [{ value: 'a', label: 'A' }] })];
    expect(visibleFormFieldKeys(t, { late: 'a' }).has('early')).toBe(false);
  });

  it('is order-independent of the answers object', () => {
    const t = [TRACK, f({ key: 'x', type: 'text', showWhen: { field: 'track', equals: ['startup'] } })];
    expect(visibleFormFieldKeys(t, { x: 'typed earlier', track: 'startup' }).has('x')).toBe(true);
  });
});

describe('isFormAcceptanceValue', () => {
  it('accepts every documented marker, case- and space-insensitively', () => {
    for (const v of ['true', 'ON', ' 1 ', 'Yes', 'accepted', 'CHECKED']) {
      expect(isFormAcceptanceValue(v)).toBe(true);
    }
  });
  it('rejects everything else, including absent', () => {
    for (const v of ['false', '', '0', 'no', 'maybe', undefined, null]) {
      expect(isFormAcceptanceValue(v)).toBe(false);
    }
  });
});

describe('isConditionSourceField', () => {
  it('accepts exactly the closed-answer types', () => {
    expect(CONDITION_SOURCE_TYPES).toEqual(['select', 'radio', 'checkbox']);
    for (const type of CONDITION_SOURCE_TYPES) expect(isConditionSourceField({ type })).toBe(true);
  });
  it('rejects free-text and structured types', () => {
    for (const type of ['text', 'textarea', 'url', 'email', 'number', 'date', 'tel', 'agreement', 'address', 'file', 'signature', 'section'] as const) {
      expect(isConditionSourceField({ type })).toBe(false);
    }
  });
});

describe('registrationTemplateSchema cross-field condition rules', () => {
  const parse = (t: FormField[]) => registrationTemplateSchema.safeParse(t);

  it('accepts a well-formed condition on an earlier choice field', () => {
    expect(parse([TRACK, f({ key: 'x', type: 'text', showWhen: { field: 'track', equals: ['startup'] } })]).success).toBe(true);
  });

  it('accepts true/false against a checkbox source', () => {
    expect(parse([IS_ENTITY, f({ key: 'x', type: 'text', showWhen: { field: 'is_entity', equals: ['true', 'false'] } })]).success).toBe(true);
  });

  it('rejects a condition naming a key that is not in the template', () => {
    const r = parse([TRACK, f({ key: 'x', type: 'text', showWhen: { field: 'ghost', equals: ['a'] } })]);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('no field has that key');
  });

  it('rejects a condition on a LATER field', () => {
    const r = parse([f({ key: 'x', type: 'text', showWhen: { field: 'track', equals: ['startup'] } }), TRACK]);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('ABOVE it');
  });

  it('rejects a self-referencing condition', () => {
    const r = parse([f({ key: 'loop', type: 'checkbox', showWhen: { field: 'loop', equals: ['true'] } })]);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('ABOVE it');
  });

  it('rejects a free-text source', () => {
    const r = parse([f({ key: 'name', type: 'text' }), f({ key: 'x', type: 'text', showWhen: { field: 'name', equals: ['bob'] } })]);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('dropdown, radio group or checkbox');
  });

  it('rejects a value the source can never produce', () => {
    const r = parse([TRACK, f({ key: 'x', type: 'text', showWhen: { field: 'track', equals: ['enterprise'] } })]);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('can never be');
  });

  it('rejects a non-boolean value against a checkbox source', () => {
    const r = parse([IS_ENTITY, f({ key: 'x', type: 'text', showWhen: { field: 'is_entity', equals: ['yes'] } })]);
    expect(r.success).toBe(false);
  });

  it('rejects an empty equals list', () => {
    const r = parse([TRACK, f({ key: 'x', type: 'text', showWhen: { field: 'track', equals: [] } })]);
    expect(r.success).toBe(false);
  });

  it('still accepts a template with no conditions at all (no regression)', () => {
    expect(parse([f({ key: 'a', type: 'text', required: true }), f({ key: 'b', type: 'textarea' })]).success).toBe(true);
  });
});
