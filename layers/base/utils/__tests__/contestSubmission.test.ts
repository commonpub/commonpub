import { describe, it, expect } from 'vitest';
import {
  isChecked,
  parseAddress,
  serializeAddress,
  isFieldFilled,
  blockingFields,
  buildSubmissionPayload,
} from '../contestSubmission';
import type { ContestSubmissionTemplateField } from '@commonpub/schema';

const f = (over: Partial<ContestSubmissionTemplateField>): ContestSubmissionTemplateField =>
  ({ key: 'k', label: 'K', type: 'text', required: false, ...over });

describe('contestSubmission helpers', () => {
  it('isChecked recognises truthy markers only', () => {
    for (const v of ['true', 'on', '1', 'YES', 'Accepted']) expect(isChecked(v)).toBe(true);
    for (const v of ['', 'false', '0', 'no', undefined]) expect(isChecked(v)).toBe(false);
  });

  it('address round-trips and drops empty subfields', () => {
    expect(serializeAddress({ line1: '1 Main', line2: '  ', city: 'Town' })).toBe(JSON.stringify({ line1: '1 Main', city: 'Town' }));
    expect(serializeAddress({})).toBe('');
    expect(parseAddress(JSON.stringify({ city: 'Town' }))).toEqual({ city: 'Town' });
    expect(parseAddress('not json')).toEqual({});
  });

  it('isFieldFilled is type-aware', () => {
    expect(isFieldFilled(f({ type: 'text' }), '  ')).toBe(false);
    expect(isFieldFilled(f({ type: 'text' }), 'x')).toBe(true);
    expect(isFieldFilled(f({ type: 'checkbox' }), 'false')).toBe(false);
    expect(isFieldFilled(f({ type: 'checkbox' }), 'true')).toBe(true);
    expect(isFieldFilled(f({ type: 'address' }), JSON.stringify({ city: 'T' }))).toBe(true);
    expect(isFieldFilled(f({ type: 'address' }), '{}')).toBe(false);
    // A section is display-only — always "filled" so a required section never blocks.
    expect(isFieldFilled(f({ type: 'section', required: true }), undefined)).toBe(true);
  });

  it('a required section never blocks submission (matches the server skip)', () => {
    const template = [
      f({ key: 'sec', label: 'Section', type: 'section', required: true }),
      f({ key: 'name', label: 'Name', type: 'text', required: true }),
    ];
    expect(blockingFields(template, { name: 'Ada' })).toEqual([]);
  });

  it('blockingFields flags required-empty + unaccepted must-accept agreements', () => {
    const template = [
      f({ key: 'name', label: 'Name', type: 'text', required: true }),
      f({ key: 'opt', label: 'Opt', type: 'text', required: false }),
      f({ key: 'tos', label: 'Terms', type: 'agreement', required: false, mustAccept: true, terms: 'x' }),
    ];
    expect(blockingFields(template, {}).sort()).toEqual(['Name', 'Terms']);
    expect(blockingFields(template, { name: 'Ada', tos: 'true' })).toEqual([]);
  });

  it('buildSubmissionPayload trims, omits blanks, normalises checkbox/agreement', () => {
    const template = [
      f({ key: 'name', label: 'Name', type: 'text', required: true }),
      f({ key: 'blank', label: 'Blank', type: 'text', required: false }),
      f({ key: 'opt', label: 'Opt', type: 'checkbox', required: false }),
      f({ key: 'tos', label: 'Terms', type: 'agreement', required: true, mustAccept: true }),
    ];
    expect(buildSubmissionPayload(template, { name: '  Ada  ', blank: '   ', opt: 'true', tos: 'on' }))
      .toEqual({ name: 'Ada', opt: 'true', tos: 'true' });
    // An unchecked agreement is simply absent (server treats absent as not-accepted).
    expect(buildSubmissionPayload(template, { name: 'Ada', opt: 'false' }))
      .toEqual({ name: 'Ada', opt: 'false' });
  });
});
