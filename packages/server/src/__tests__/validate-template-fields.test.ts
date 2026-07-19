import { describe, it, expect } from 'vitest';
import type { ContestSubmissionTemplateField } from '@commonpub/schema';
import { validateSubmissionFields } from '../contest/validation.js';

// Pure validate + partition unit tests, with a focus on the P1 field types
// (section / radio / tel) shared by entry submissions and registration forms.

const f = (o: Partial<ContestSubmissionTemplateField> & { key: string; type: ContestSubmissionTemplateField['type'] }): ContestSubmissionTemplateField => ({
  label: o.key, required: false, ...o,
});

describe('validateSubmissionFields — P1 field types', () => {
  it('section: display-only — skipped, never stored, even if a value is supplied', () => {
    const tmpl = [f({ key: 'intro', type: 'section', label: 'Your details' }), f({ key: 'name', type: 'text' })];
    const r = validateSubmissionFields(tmpl, { intro: 'ignored', name: 'Ada' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.artifact).toEqual({ name: 'Ada' });
      expect('intro' in r.result.artifact).toBe(false);
    }
  });

  it('section: a required section never blocks submission (no value expected)', () => {
    const tmpl = [f({ key: 'hdr', type: 'section', required: true })];
    expect(validateSubmissionFields(tmpl, {}).ok).toBe(true);
  });

  it('radio: accepts a listed option, rejects an unlisted one (like select)', () => {
    const tmpl = [f({ key: 'track', type: 'radio', required: true, options: [{ value: 'dev', label: 'Developer' }, { value: 'startup', label: 'Startup' }] })];
    const ok = validateSubmissionFields(tmpl, { track: 'dev' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.result.artifact).toEqual({ track: 'dev' });
    const bad = validateSubmissionFields(tmpl, { track: 'other' });
    expect(bad.ok).toBe(false);
  });

  it('tel: accepts common phone formats, rejects junk', () => {
    const tmpl = [f({ key: 'phone', type: 'tel' })];
    for (const good of ['+1 (555) 123-4567', '5551234567', '+44 20 7946 0958']) {
      expect(validateSubmissionFields(tmpl, { phone: good }).ok, good).toBe(true);
    }
    // Junk: non-phone chars, too few/many digits, and punctuation-only (no digits).
    for (const bad of ['abc', '123456', 'call-me', '((((((()', '.......', '1234567890123456']) {
      expect(validateSubmissionFields(tmpl, { phone: bad }).ok, bad).toBe(false);
    }
  });

  it('tel marked pii routes to the private partition', () => {
    const tmpl = [f({ key: 'phone', type: 'tel', pii: true })];
    const r = validateSubmissionFields(tmpl, { phone: '5551234567' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.pii).toEqual({ phone: '5551234567' });
      expect(r.result.artifact).toEqual({});
    }
  });

  it('rejects an unknown key not in the template (no smuggling)', () => {
    const tmpl = [f({ key: 'name', type: 'text' })];
    expect(validateSubmissionFields(tmpl, { name: 'x', sneaky: 'y' }).ok).toBe(false);
  });

  it('file: accepts a uuid ref (shape only) and partitions it PRIVATE', () => {
    const id = '11111111-2222-3333-4444-555555555555';
    const tmpl = [f({ key: 'doc', type: 'file' })];
    const r = validateSubmissionFields(tmpl, { doc: id });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.pii).toEqual({ doc: id }); // always private
      expect(r.result.artifact).toEqual({});
    }
    // A non-uuid value is rejected at the shape gate.
    expect(validateSubmissionFields(tmpl, { doc: 'not-a-file' }).ok).toBe(false);
  });

  it('signature: a typed name stores like a text answer', () => {
    const tmpl = [f({ key: 'sig', type: 'signature', required: true })];
    const r = validateSubmissionFields(tmpl, { sig: 'Ada Lovelace' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.artifact).toEqual({ sig: 'Ada Lovelace' });
    expect(validateSubmissionFields(tmpl, { sig: '' }).ok).toBe(false); // required
  });

  it('enforces a per-field maxLength (server-side, not just the input hint)', () => {
    const tmpl = [f({ key: 'building', type: 'textarea', maxLength: 10 })];
    expect(validateSubmissionFields(tmpl, { building: 'short' }).ok).toBe(true);
    const long = validateSubmissionFields(tmpl, { building: 'x'.repeat(11) });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error).toMatch(/too long/i);
  });
});
