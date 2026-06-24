/**
 * Unit tests for the submission-form builder presets + whole-form templates (P2).
 * As with contestTemplates, the strongest guarantee is that every preset/template
 * field validates against the REAL server Zod schema so a seeded form actually
 * saves end to end, and that derived keys stay unique.
 */
import { describe, it, expect } from 'vitest';
import { contestStageSchema } from '@commonpub/schema';
import {
  FIELD_PRESETS,
  availableFieldPresets,
  templatePresetAdded,
  SUBMISSION_FORM_TEMPLATES,
  availableFormTemplates,
} from '../contestSubmissionTemplates';

const validateTemplate = (submissionTemplate: unknown[]): boolean =>
  contestStageSchema.safeParse({ id: 's1', name: 'Proposals', kind: 'submission', submissionTemplate }).success;

describe('field presets', () => {
  it('availableFieldPresets hides PII presets when PII is off', () => {
    const off = availableFieldPresets(false).map((p) => p.id);
    expect(off).not.toContain('address');
    expect(off).not.toContain('agreement');
    const on = availableFieldPresets(true).map((p) => p.id);
    expect(on).toContain('address');
    expect(on).toContain('agreement');
  });

  it('templatePresetAdded appends a field with a unique, schema-valid key', () => {
    const email = FIELD_PRESETS.find((p) => p.id === 'email')!;
    let t = templatePresetAdded([], email);
    t = templatePresetAdded(t, email); // add a second Email
    expect(t).toHaveLength(2);
    expect(new Set(t.map((f) => f.key)).size).toBe(2);
    for (const f of t) expect(f.key).toMatch(/^[a-z0-9_]+$/);
    expect(validateTemplate(t)).toBe(true);
  });

  it('the address preset forces pii and the agreement preset must-accepts', () => {
    const address = templatePresetAdded([], FIELD_PRESETS.find((p) => p.id === 'address')!)[0]!;
    expect(address.type).toBe('address');
    expect(address.pii).toBe(true);
    const agreement = templatePresetAdded([], FIELD_PRESETS.find((p) => p.id === 'agreement')!)[0]!;
    expect(agreement.type).toBe('agreement');
    expect(agreement.mustAccept).toBe(true);
  });

  it.each(FIELD_PRESETS)('preset $id seeds a schema-valid field', (preset) => {
    const seeded = templatePresetAdded([], preset);
    // A `select` seeds one blank option for the organiser to fill (it isn't valid
    // until they do, same as the existing changeType behaviour); fill it so the
    // preset's other defaults can be schema-checked.
    if (seeded[0]!.type === 'select') seeded[0]!.options = [{ value: 'a', label: 'Option A' }];
    expect(validateTemplate(seeded)).toBe(true);
  });
});

describe('whole-form templates', () => {
  it('availableFormTemplates hides PII-only templates when PII is off', () => {
    expect(availableFormTemplates(false).map((t) => t.id)).not.toContain('hardware');
    expect(availableFormTemplates(true).map((t) => t.id)).toContain('hardware');
  });

  it('standard proposal adds an agreement only when PII is on', () => {
    const std = SUBMISSION_FORM_TEMPLATES.find((t) => t.id === 'standard')!;
    expect(std.build({ pii: true }).some((f) => f.type === 'agreement')).toBe(true);
    expect(std.build({ pii: false }).some((f) => f.type === 'agreement')).toBe(false);
    expect(std.build({ pii: false }).map((f) => f.key)).toContain('description');
  });

  it('hardware template seeds an address + shipping agreement when PII is on', () => {
    const hw = SUBMISSION_FORM_TEMPLATES.find((t) => t.id === 'hardware')!;
    const fields = hw.build({ pii: true });
    expect(fields.some((f) => f.type === 'address')).toBe(true);
    expect(fields.filter((f) => f.type === 'agreement')).toHaveLength(1);
  });

  it('blank template is empty', () => {
    expect(SUBMISSION_FORM_TEMPLATES.find((t) => t.id === 'blank')!.build({ pii: true })).toEqual([]);
  });

  it.each(SUBMISSION_FORM_TEMPLATES.flatMap((t) => [
    { id: t.id, pii: true },
    { id: t.id, pii: false },
  ]))('template $id ($pii) produces unique, schema-valid fields', ({ id, pii }) => {
    const fields = SUBMISSION_FORM_TEMPLATES.find((t) => t.id === id)!.build({ pii });
    expect(new Set(fields.map((f) => f.key)).size).toBe(fields.length);
    expect(validateTemplate(fields)).toBe(true);
  });
});
