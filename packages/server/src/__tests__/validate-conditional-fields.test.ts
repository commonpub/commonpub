import { describe, it, expect } from 'vitest';
import type { ContestSubmissionTemplateField } from '@commonpub/schema';
import { validateSubmissionFields } from '../contest/validation.js';

// Conditional form fields (P7), server side. The server is the authoritative
// validator, so these cases pin the two behaviours the client depends on:
// a hidden field is not required, and a hidden field's answer is not stored.
//
// The partition rules (artifact / PII / agreements) must be unchanged for every
// field that IS visible — a condition changes whether a field is asked, never
// where its answer lives.

const f = (o: Partial<ContestSubmissionTemplateField> & { key: string; type: ContestSubmissionTemplateField['type'] }): ContestSubmissionTemplateField => ({
  label: o.key, required: false, ...o,
});

const TRACK = f({
  key: 'track',
  type: 'select',
  required: true,
  options: [{ value: 'developer', label: 'Developer' }, { value: 'startup', label: 'Startup' }],
});
const IS_ENTITY = f({ key: 'is_entity', type: 'checkbox' });

describe('validateSubmissionFields — conditional display', () => {
  it('does not demand a required field whose condition is unmet', () => {
    const tmpl = [TRACK, f({ key: 'ein', type: 'text', required: true, showWhen: { field: 'track', equals: ['startup'] } })];
    const r = validateSubmissionFields(tmpl, { track: 'developer' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.artifact).toEqual({ track: 'developer' });
  });

  it('does demand it once the condition is met', () => {
    const tmpl = [TRACK, f({ key: 'ein', type: 'text', required: true, showWhen: { field: 'track', equals: ['startup'] } })];
    const r = validateSubmissionFields(tmpl, { track: 'startup' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('ein');
  });

  it('drops an answer to a hidden field rather than storing a stale one', () => {
    // The entrant picked "startup", typed an EIN, then switched to "developer".
    // Storing the orphaned EIN would keep an answer to a question they are no
    // longer being asked.
    const tmpl = [TRACK, f({ key: 'ein', type: 'text', showWhen: { field: 'track', equals: ['startup'] } })];
    const r = validateSubmissionFields(tmpl, { track: 'developer', ein: '12-3456789' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.artifact).toEqual({ track: 'developer' });
  });

  it('drops a hidden PII answer from the private partition too', () => {
    const tmpl = [
      TRACK,
      f({ key: 'ship', type: 'address', showWhen: { field: 'track', equals: ['startup'] } }),
    ];
    const r = validateSubmissionFields(tmpl, { track: 'developer', ship: JSON.stringify({ line1: '1 Test St' }) });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.pii).toEqual({});
      expect(r.result.artifact).toEqual({ track: 'developer' });
    }
  });

  it('does not record a hidden agreement as accepted', () => {
    const tmpl = [
      IS_ENTITY,
      f({ key: 'entity_terms', type: 'agreement', required: true, terms: 'Entity terms', showWhen: { field: 'is_entity', equals: ['true'] } }),
    ];
    const r = validateSubmissionFields(tmpl, { is_entity: 'false', entity_terms: 'true' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.agreements).toEqual([]);
  });

  it('still requires a hidden-then-shown agreement once its condition holds', () => {
    const tmpl = [
      IS_ENTITY,
      f({ key: 'entity_terms', type: 'agreement', required: true, terms: 'Entity terms', showWhen: { field: 'is_entity', equals: ['true'] } }),
    ];
    const missing = validateSubmissionFields(tmpl, { is_entity: 'true' });
    expect(missing.ok).toBe(false);
    const accepted = validateSubmissionFields(tmpl, { is_entity: 'true', entity_terms: 'true' });
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(accepted.result.agreements.map((a) => a.fieldKey)).toEqual(['entity_terms']);
  });

  it('skips domain validation for a hidden field, so a stale bad value cannot 400 the submit', () => {
    // Without the visibility check this rejects with "must be an http(s) URL" for a
    // field the entrant cannot see — an unfixable error.
    const tmpl = [TRACK, f({ key: 'site', type: 'url', showWhen: { field: 'track', equals: ['startup'] } })];
    const r = validateSubmissionFields(tmpl, { track: 'developer', site: 'not a url' });
    expect(r.ok).toBe(true);
  });

  it('gates a whole section, header rule and all', () => {
    const tmpl = [
      IS_ENTITY,
      f({ key: 'org', type: 'section', showWhen: { field: 'is_entity', equals: ['true'] } }),
      f({ key: 'org_name', type: 'text', required: true }),
      f({ key: 'project', type: 'section' }),
      f({ key: 'repo', type: 'url', required: true }),
    ];
    const hidden = validateSubmissionFields(tmpl, { is_entity: 'false', repo: 'https://example.com/x' });
    expect(hidden.ok).toBe(true);
    if (hidden.ok) expect(hidden.result.artifact).toEqual({ is_entity: 'false', repo: 'https://example.com/x' });

    const shown = validateSubmissionFields(tmpl, { is_entity: 'true', repo: 'https://example.com/x' });
    expect(shown.ok).toBe(false);
    if (!shown.ok) expect(shown.error).toContain('org_name');
  });

  it('still rejects a key that is not in the template at all', () => {
    // Conditional display must not become a hole in the unknown-key guard: a
    // hidden field's key is IN the template, a smuggled key is not.
    const tmpl = [TRACK];
    const r = validateSubmissionFields(tmpl, { track: 'developer', smuggled: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Unknown field');
  });

  it('leaves an unconditional template byte-identical (no regression)', () => {
    const tmpl = [
      f({ key: 'name', type: 'text', required: true }),
      f({ key: 'mail', type: 'email', required: true }),
      f({ key: 'terms', type: 'agreement', required: true, terms: 'T' }),
    ];
    const r = validateSubmissionFields(tmpl, { name: 'Ada', mail: 'a@b.co', terms: 'true' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.artifact).toEqual({ name: 'Ada' });
      expect(r.result.pii).toEqual({ mail: 'a@b.co' });
      expect(r.result.agreements.map((a) => a.fieldKey)).toEqual(['terms']);
    }
  });
});
