/**
 * Tests for autoFormSchema — the pure Zod → form-field-descriptor engine
 * that drives the Phase 3e section/row config inspectors.
 *
 * Strategy:
 *   - Table-test EVERY builtin section schema (SECTION_CONFIG_SCHEMAS) so
 *     adding a section that the engine can't represent fails loudly.
 *   - Drill the tricky node kinds: union-of-number-const (heading.level,
 *     columns), array<object> repeaters (hero.ctas), pattern strings
 *     (image.src must stay single-line text, NOT type=url), long strings
 *     (paragraph.html → textarea), empty object (stats → isEmpty).
 *   - Assert form-required semantics: a field with a default is NOT
 *     required (it's pre-filled); a no-default field in `required` IS.
 *   - Dogfood the row-config schema (layoutRowConfigSchema) — the same
 *     engine serves both inspectors.
 *
 * Pure engine, no Vue — see the module header on why the logic lives
 * outside the .vue (feedback-css-cascade-unit-test-blind-spot).
 */
import { describe, it, expect } from 'vitest';
import {
  SECTION_CONFIG_SCHEMAS,
  layoutRowConfigSchema,
  heroConfigSchema,
  headingConfigSchema,
  imageConfigSchema,
  paragraphConfigSchema,
  contentFeedConfigSchema,
  editorialConfigSchema,
  statsConfigSchema,
} from '@commonpub/schema';
import {
  buildAutoForm,
  buildDefaults,
  humanizeKey,
  type AutoFormField,
} from '../autoFormSchema';

function field(fields: AutoFormField[], key: string): AutoFormField {
  const f = fields.find((x) => x.key === key);
  if (!f) throw new Error(`field "${key}" not found in [${fields.map((x) => x.key).join(', ')}]`);
  return f;
}

describe('autoFormSchema — buildAutoForm', () => {
  it('represents every builtin section schema without throwing', () => {
    for (const [type, schema] of Object.entries(SECTION_CONFIG_SCHEMAS)) {
      const model = buildAutoForm(schema);
      // stats is intentionally empty; everything else has fields.
      if (type === 'stats') {
        expect(model.isEmpty, `${type} should be empty`).toBe(true);
        expect(model.fields).toHaveLength(0);
      } else {
        expect(model.isEmpty, `${type} should NOT be empty`).toBe(false);
        expect(model.fields.length, `${type} should have fields`).toBeGreaterThan(0);
        // No field should fall through to 'unsupported' for current builtins.
        for (const f of model.fields) {
          expect(f.control, `${type}.${f.key} should be supported`).not.toBe('unsupported');
        }
      }
    }
  });

  it('maps string enums to select with all options', () => {
    const { fields } = buildAutoForm(imageConfigSchema);
    const size = field(fields, 'size');
    expect(size.control).toBe('select');
    expect(size.options?.map((o) => o.value)).toEqual(['s', 'm', 'l', 'full']);
  });

  it('maps union-of-number-literals to a numeric select (heading.level)', () => {
    const { fields } = buildAutoForm(headingConfigSchema);
    const level = field(fields, 'level');
    expect(level.control).toBe('select');
    expect(level.options?.map((o) => o.value)).toEqual([1, 2, 3, 4, 5, 6]);
    // It has a default (2) so it is NOT form-required.
    expect(level.required).toBe(false);
    expect(level.defaultValue).toBe(2);
  });

  it('maps content-feed.columns union + limit number', () => {
    const { fields } = buildAutoForm(contentFeedConfigSchema);
    const columns = field(fields, 'columns');
    expect(columns.control).toBe('select');
    expect(columns.options?.map((o) => o.value)).toEqual([2, 3, 4]);

    const limit = field(fields, 'limit');
    expect(limit.control).toBe('number');
    expect(limit.min).toBe(1);
    expect(limit.max).toBe(24);
    expect(limit.step).toBe(1); // integer
  });

  it('maps a bounded integer (editorial.limit)', () => {
    const { fields } = buildAutoForm(editorialConfigSchema);
    const limit = field(fields, 'limit');
    expect(limit.control).toBe('number');
    expect(limit.min).toBe(1);
    expect(limit.max).toBe(12);
    expect(limit.step).toBe(1);
  });

  it('keeps URL-pattern strings as single-line text (NOT type=url) + carries the pattern', () => {
    const { fields } = buildAutoForm(imageConfigSchema);
    const src = field(fields, 'src');
    expect(src.control).toBe('text');
    expect(src.pattern).toBeTruthy();
    // src maxLength is 2048 but pattern wins → must not become a textarea.
    expect(src.control).not.toBe('textarea');
  });

  it('maps long strings to textarea (paragraph.html)', () => {
    const { fields } = buildAutoForm(paragraphConfigSchema);
    const html = field(fields, 'html');
    expect(html.control).toBe('textarea');
    expect(html.maxLength).toBe(8000);
  });

  it('keeps short strings as text inputs', () => {
    const { fields } = buildAutoForm(headingConfigSchema);
    const text = field(fields, 'text');
    expect(text.control).toBe('text'); // maxLength 240 < 480 threshold
  });

  it('maps array<object> to a repeater with item sub-fields + a blank item default (hero.ctas)', () => {
    const { fields } = buildAutoForm(heroConfigSchema);
    const ctas = field(fields, 'ctas');
    expect(ctas.control).toBe('array');
    expect(ctas.maxItems).toBe(2);
    const itemKeys = ctas.itemFields?.map((f) => f.key);
    expect(itemKeys).toEqual(['label', 'href', 'variant']);
    // label/href have no default → form-required; variant has a default.
    const label = ctas.itemFields!.find((f) => f.key === 'label')!;
    const href = ctas.itemFields!.find((f) => f.key === 'href')!;
    const variant = ctas.itemFields!.find((f) => f.key === 'variant')!;
    expect(label.required).toBe(true);
    expect(href.required).toBe(true);
    expect(href.pattern).toBeTruthy(); // URL_LINK_STRICT guard surfaces
    expect(variant.required).toBe(false);
    expect(variant.control).toBe('select');
    // The blank item the "+ Add" button appends.
    expect(ctas.itemDefault).toEqual({ label: '', href: '', variant: 'primary' });
  });

  it('flags an empty schema (stats) as isEmpty', () => {
    const model = buildAutoForm(statsConfigSchema);
    expect(model.isEmpty).toBe(true);
    expect(model.fields).toEqual([]);
  });

  it('dogfoods the row-config schema (gap/align/background/paddingY)', () => {
    const { fields, isEmpty } = buildAutoForm(layoutRowConfigSchema);
    expect(isEmpty).toBe(false);
    const keys = fields.map((f) => f.key).sort();
    expect(keys).toEqual(['align', 'background', 'gap', 'paddingY']);
    expect(field(fields, 'gap').control).toBe('select');
    expect(field(fields, 'align').control).toBe('select');
    expect(field(fields, 'paddingY').control).toBe('select');
    expect(field(fields, 'background').control).toBe('text');
    // All row-config fields are .optional() with no default → not required,
    // BUT optional (so selects offer a leading "default" choice).
    for (const f of fields) {
      expect(f.required).toBe(false);
      expect(f.optional).toBe(true);
    }
  });

  it('marks defaulted fields as NOT optional (heading.level has a default)', () => {
    const { fields } = buildAutoForm(headingConfigSchema);
    // level/text both have defaults → pre-filled, neither required nor optional-empty.
    expect(field(fields, 'level').optional).toBe(false);
    expect(field(fields, 'text').optional).toBe(false);
  });
});

describe('autoFormSchema — helpers', () => {
  it('humanizes keys', () => {
    expect(humanizeKey('customTitle')).toBe('Custom title');
    expect(humanizeKey('categorySlug')).toBe('Category slug');
    expect(humanizeKey('paddingY')).toBe('Padding y');
    expect(humanizeKey('html')).toBe('Html');
  });

  it('builds defaults from a field list', () => {
    const { fields } = buildAutoForm(heroConfigSchema);
    const defaults = buildDefaults(fields);
    // hero has defaults for every top-level field.
    expect(defaults).toEqual({ variant: 'default', customTitle: '', customSubtitle: '', ctas: [] });
  });
});
