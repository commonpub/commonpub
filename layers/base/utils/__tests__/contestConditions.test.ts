import { describe, it, expect } from 'vitest';
import { visibleFormFieldKeys, type ContestSubmissionTemplateField as FormField } from '@commonpub/schema';
import {
  templateConditionsRepaired,
  templateFieldConditionSet,
  conditionSourcesFor,
  conditionValueChoices,
  templateFieldRemoved,
  templateFieldMoved,
  templateFieldTypeChanged,
  templateFieldLabelChanged,
  templateOptionSet,
  templateOptionRemoved,
} from '../contestStages';
import { blockingFieldKeys, buildSubmissionPayload, visibleTemplateFields } from '../contestSubmission';
import { registrationMarkdownToTemplate, templateToRegistrationMarkdown } from '../registrationMarkdown';

// Conditional form fields (P7), builder side. The repair pass is the reason an
// operator can delete, move or retype a field without the NEXT save failing Zod
// with an error about a field they were not editing.

const f = (o: Partial<FormField> & Pick<FormField, 'key' | 'type'>): FormField => ({
  label: o.key, required: false, ...o,
});

const TRACK = f({
  key: 'track',
  type: 'select',
  options: [{ value: 'developer', label: 'Developer' }, { value: 'startup', label: 'Startup' }],
});
const IS_ENTITY = f({ key: 'is_entity', type: 'checkbox' });
const dependent = (key = 'ein', field = 'track', equals = ['startup']): FormField =>
  f({ key, type: 'text', showWhen: { field, equals } });

describe('templateConditionsRepaired', () => {
  it('leaves a valid template untouched, and returns the SAME array (no false dirty)', () => {
    const t = [TRACK, dependent()];
    expect(templateConditionsRepaired(t)).toBe(t);
  });

  it('drops a condition whose source is gone', () => {
    const t = [dependent()];
    expect(templateConditionsRepaired(t)[0]!.showWhen).toBeUndefined();
  });

  it('drops a condition whose source now sits BELOW the dependent', () => {
    const t = [dependent(), TRACK];
    expect(templateConditionsRepaired(t)[0]!.showWhen).toBeUndefined();
  });

  it('drops a condition whose source is no longer a legal source type', () => {
    const t = [f({ key: 'track', type: 'text' }), dependent()];
    expect(templateConditionsRepaired(t)[1]!.showWhen).toBeUndefined();
  });

  it('prunes an equals value the source can no longer produce', () => {
    const t = [TRACK, dependent('ein', 'track', ['startup', 'enterprise'])];
    expect(templateConditionsRepaired(t)[1]!.showWhen).toEqual({ field: 'track', equals: ['startup'] });
  });

  it('drops the whole condition when pruning empties it', () => {
    const t = [TRACK, dependent('ein', 'track', ['enterprise'])];
    expect(templateConditionsRepaired(t)[1]!.showWhen).toBeUndefined();
  });

  it('removes the key outright rather than leaving showWhen: undefined in the saved jsonb', () => {
    const repaired = templateConditionsRepaired([dependent()]);
    expect(Object.prototype.hasOwnProperty.call(repaired[0]!, 'showWhen')).toBe(false);
  });
});

describe('structural edits keep conditions coherent', () => {
  it('deleting the source clears its dependents', () => {
    const t = [TRACK, dependent()];
    expect(templateFieldRemoved(t, 0)[0]!.showWhen).toBeUndefined();
  });

  it('moving the source below its dependent clears the rule', () => {
    const t = [TRACK, dependent()];
    expect(templateFieldMoved(t, 0, 1)[0]!.showWhen).toBeUndefined();
  });

  it('retyping the source to free text clears its dependents', () => {
    const t = [TRACK, dependent()];
    expect(templateFieldTypeChanged(t, 0, 'text')[1]!.showWhen).toBeUndefined();
  });

  it('renaming an option value prunes the stale rule', () => {
    const t = [TRACK, dependent()];
    const renamed = templateOptionSet(t, 0, 1, { value: 'scaleup' });
    expect(renamed[1]!.showWhen).toBeUndefined();
  });

  it('deleting the matched option prunes the stale rule', () => {
    const t = [TRACK, dependent()];
    expect(templateOptionRemoved(t, 0, 1)[1]!.showWhen).toBeUndefined();
  });

  it('renaming a source LABEL carries its dependents to the new key', () => {
    // The key tracks the label until an operator hand-edits it, so typing in the
    // label box re-keys the field. Without the rename-follow, one keystroke in
    // the source's label silently orphans every rule that points at it.
    const t = [TRACK, dependent()];
    const renamed = templateFieldLabelChanged(t, 0, 'Entry track');
    expect(renamed[0]!.key).toBe('entry_track');
    expect(renamed[1]!.showWhen).toEqual({ field: 'entry_track', equals: ['startup'] });
  });

  it('does not re-key (or re-point) when the key was hand-edited away from the label', () => {
    const t = [{ ...TRACK, key: 'custom_key' }, dependent('ein', 'custom_key')];
    const renamed = templateFieldLabelChanged(t, 0, 'Entry track');
    expect(renamed[0]!.key).toBe('custom_key');
    expect(renamed[1]!.showWhen).toEqual({ field: 'custom_key', equals: ['startup'] });
  });
});

describe('templateFieldConditionSet', () => {
  it('sets a condition', () => {
    const t = [TRACK, f({ key: 'ein', type: 'text' })];
    expect(templateFieldConditionSet(t, 1, { field: 'track', equals: ['startup'] })[1]!.showWhen)
      .toEqual({ field: 'track', equals: ['startup'] });
  });
  it('clearing deletes the key', () => {
    const cleared = templateFieldConditionSet([TRACK, dependent()], 1, null);
    expect(Object.prototype.hasOwnProperty.call(cleared[1]!, 'showWhen')).toBe(false);
  });
});

describe('conditionSourcesFor / conditionValueChoices', () => {
  it('offers only closed-answer fields ABOVE the target', () => {
    const t = [f({ key: 'name', type: 'text' }), IS_ENTITY, TRACK, f({ key: 'x', type: 'text' })];
    expect(conditionSourcesFor(t, 3).map((s) => s.key)).toEqual(['is_entity', 'track']);
    expect(conditionSourcesFor(t, 1).map((s) => s.key)).toEqual([]);
  });

  it('skips a choice field that has no usable option value yet', () => {
    const blank = f({ key: 'blank', type: 'select', options: [{ value: '', label: '' }] });
    expect(conditionSourcesFor([blank, f({ key: 'x', type: 'text' })], 1)).toEqual([]);
  });

  it('offers checked / not checked for a checkbox, and the option values otherwise', () => {
    expect(conditionValueChoices(IS_ENTITY)).toEqual([
      { value: 'true', label: 'Checked' },
      { value: 'false', label: 'Not checked' },
    ]);
    expect(conditionValueChoices(TRACK)).toEqual([
      { value: 'developer', label: 'Developer' },
      { value: 'startup', label: 'Startup' },
    ]);
  });
});

describe('entrant-side helpers honour visibility', () => {
  const tmpl = [TRACK, f({ key: 'ein', type: 'text', required: true, showWhen: { field: 'track', equals: ['startup'] } })];

  it('a hidden required field does not block submission', () => {
    expect(blockingFieldKeys(tmpl, { track: 'developer' })).toEqual([]);
    expect(blockingFieldKeys(tmpl, { track: 'startup' })).toEqual(['ein']);
  });

  it('a hidden field is not rendered', () => {
    expect(visibleTemplateFields(tmpl, { track: 'developer' }).map((x) => x.key)).toEqual(['track']);
    expect(visibleTemplateFields(tmpl, { track: 'startup' }).map((x) => x.key)).toEqual(['track', 'ein']);
  });

  it('a hidden field is not put on the wire', () => {
    expect(buildSubmissionPayload(tmpl, { track: 'developer', ein: '12-3456789' })).toEqual({ track: 'developer' });
    expect(buildSubmissionPayload(tmpl, { track: 'startup', ein: '12-3456789' })).toEqual({ track: 'startup', ein: '12-3456789' });
  });
});

describe('registration markdown round-trips conditions', () => {
  it('parses show=key:value on a field', () => {
    const { fields, errors } = registrationMarkdownToTemplate(
      ['- Track* (select): Developer, Startup', '- EIN (text, show=track:startup)'].join('\n'),
    );
    expect(errors).toEqual([]);
    expect(fields[1]!.showWhen).toEqual({ field: 'track', equals: ['startup'] });
  });

  it('parses pipe-separated values', () => {
    const { fields, errors } = registrationMarkdownToTemplate(
      ['- Track* (select): Developer, Startup', '- Notes (text, show=track:developer|startup)'].join('\n'),
    );
    expect(errors).toEqual([]);
    expect(fields[1]!.showWhen).toEqual({ field: 'track', equals: ['developer', 'startup'] });
  });

  it('parses a condition on a section heading and keeps the title clean', () => {
    const { fields, errors } = registrationMarkdownToTemplate(
      ['- Registered US entity (checkbox)', '## Organization (show=registered_us_entity:true)', '- Legal name (text)'].join('\n'),
    );
    expect(errors).toEqual([]);
    expect(fields[1]!.label).toBe('Organization');
    expect(fields[1]!.showWhen).toEqual({ field: 'registered_us_entity', equals: ['true'] });
  });

  it('round-trips: export then re-import preserves every rule', () => {
    const original: FormField[] = [
      TRACK,
      IS_ENTITY,
      f({ key: 'org', type: 'section', label: 'Organization', showWhen: { field: 'is_entity', equals: ['true'] } }),
      f({ key: 'ein', type: 'text', label: 'EIN', required: true, showWhen: { field: 'track', equals: ['startup'] } }),
    ];
    const md = templateToRegistrationMarkdown(original);
    const { fields, errors } = registrationMarkdownToTemplate(md);
    expect(errors).toEqual([]);
    expect(fields.map((x) => x.showWhen)).toEqual(original.map((x) => x.showWhen));
  });

  it('reports a rule naming a missing field instead of importing it silently', () => {
    const { errors } = registrationMarkdownToTemplate('- EIN (text, show=ghost:startup)');
    expect(errors.join(' ')).toContain('no field has that key');
  });

  it('reports a rule pointing at a field below it', () => {
    const { errors } = registrationMarkdownToTemplate(
      ['- EIN (text, show=track:startup)', '- Track (select): Developer, Startup'].join('\n'),
    );
    expect(errors.join(' ')).toContain('ABOVE it');
  });

  it('reports a rule on a free-text source', () => {
    const { errors } = registrationMarkdownToTemplate(
      ['- Name (text)', '- EIN (text, show=name:bob)'].join('\n'),
    );
    expect(errors.join(' ')).toContain('dropdown, radio group or checkbox');
  });

  it('reports a value the source can never answer', () => {
    const { errors } = registrationMarkdownToTemplate(
      ['- Track (select): Developer, Startup', '- EIN (text, show=track:enterprise)'].join('\n'),
    );
    expect(errors.join(' ')).toContain('can never answer');
  });

  it('leaves a form with no conditions byte-identical through a round trip', () => {
    const md = ['## Basics', '- Full name* (text)', '- Email* (email, pii)'].join('\n');
    const { fields, errors } = registrationMarkdownToTemplate(md);
    expect(errors).toEqual([]);
    expect(fields.every((x) => x.showWhen === undefined)).toBe(true);
    expect(templateToRegistrationMarkdown(fields)).toContain('- Full name* (text)');
  });
});

// Key stability. Found by the session-256 audit: `templateFieldLabelChanged`
// regenerates the machine key from the label whenever the key still matches the
// old label's slug — which is true for every field an operator has not hand-keyed,
// because the builder never exposes `key`. On a live form that means fixing a typo
// in a label silently orphans every stored answer, private-field entry and
// agreement acceptance recorded under the old key.
describe('persisted keys survive a label edit', () => {
  const saved: FormField[] = [
    f({ key: 'repositry_url', label: 'Repositry URL', type: 'text' }),
    f({ key: 'notes', label: 'Notes', type: 'textarea' }),
  ];
  const locked = new Set(['repositry_url', 'notes']);

  it('does NOT rekey a field whose key was already saved', () => {
    const fixed = templateFieldLabelChanged(saved, 0, 'Repository URL', locked);
    expect(fixed[0]!.label).toBe('Repository URL');
    expect(fixed[0]!.key).toBe('repositry_url'); // the typo lives on in the key, and must
  });

  it('still tracks the label for a field added in this session', () => {
    const withNew = [...saved, f({ key: '', label: '', type: 'text' })];
    const typed = templateFieldLabelChanged(withNew, 2, 'Team size', locked);
    expect(typed[2]!.key).toBe('team_size');
  });

  it('without a locked set, the old label-tracking behaviour is unchanged', () => {
    // The pure op keeps its previous contract when no lock is supplied, so every
    // existing caller (and the create-mode editor) behaves exactly as before.
    const renamed = templateFieldLabelChanged(saved, 0, 'Repository URL');
    expect(renamed[0]!.key).toBe('repository_url');
  });

  it('a locked source keeps its key, so conditions pointing at it stay valid', () => {
    const withRule = [
      f({ key: 'track', type: 'select', label: 'Track', options: [{ value: 'startup', label: 'Startup' }] }),
      dependent('ein', 'track'),
    ];
    const renamed = templateFieldLabelChanged(withRule, 0, 'Entry track', new Set(['track', 'ein']));
    expect(renamed[0]!.key).toBe('track');
    expect(renamed[1]!.showWhen).toEqual({ field: 'track', equals: ['startup'] });
  });
});

// Round-2 audit findings against this session's own work.
describe('round-2 audit fixes', () => {
  it('an option value with surrounding whitespace is trimmed, so a rule on it can match', async () => {
    // Before: the option stored ' startup ', the validator compared the raw string
    // (so the rule saved fine), but `visibleFormFieldKeys` trims the submitted
    // answer — so the dependent field was hidden forever with nothing saying why.
    const { registrationTemplateSchema } = await import('@commonpub/schema');
    const parsed = registrationTemplateSchema.safeParse([
      { key: 'track', label: 'Track', type: 'select', required: true, options: [{ value: ' startup ', label: ' Startup ' }] },
      { key: 'ein', label: 'EIN', type: 'text', required: false, showWhen: { field: 'track', equals: [' startup '] } },
    ]);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data[0]!.options![0]!.value).toBe('startup');
      expect(parsed.data[1]!.showWhen!.equals).toEqual(['startup']);
      // And the trimmed pair actually resolves.
      expect(visibleFormFieldKeys(parsed.data as FormField[], { track: 'startup' }).has('ein')).toBe(true);
    }
  });
});
