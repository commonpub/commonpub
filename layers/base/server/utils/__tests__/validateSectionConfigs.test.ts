/**
 * Tests for the per-section configSchema validator (P1 fix from
 * session 160 audit, wired live in session 161 after the schemas
 * moved to `@commonpub/schema/sectionConfigs`).
 *
 * The validator looks up schemas via `SECTION_CONFIG_SCHEMAS` from
 * `@commonpub/schema` — server-safe (no Vue imports). This file no
 * longer needs to import the section registry (which transitively
 * imports `.vue`); previously the test pulled the real registry to
 * exercise production schemas, but that's now unnecessary because
 * the schemas LIVE in the schema package.
 *
 * Coverage:
 *   - Happy path: empty input + valid section
 *   - Unknown section type → 400 with `Unknown section type` message
 *   - Bulk reporting: every bad section in the payload, not just the first
 *   - Position tracking: zone + rowIndex + sectionIndex preserved
 *   - **Per-section enforcement** (the actual win): URL guards reject
 *     javascript: in cta hrefs, array bounds reject 21 gallery images,
 *     enum walls reject unknown variants
 */
import { describe, it, expect } from 'vitest';
import { validateSectionConfigs } from '../validateSectionConfigs';

describe('validateSectionConfigs — happy path', () => {
  it('passes for empty zones (nothing to validate)', () => {
    expect(() => validateSectionConfigs([])).not.toThrow();
    expect(() => validateSectionConfigs([{ zone: 'main', rows: [] }])).not.toThrow();
  });

  it('passes for a section with valid config (divider — simplest)', () => {
    expect(() => validateSectionConfigs([{
      zone: 'main',
      rows: [{ sections: [{ type: 'divider', config: {} }] }],
    }])).not.toThrow();
  });

  it('passes for multiple sections of different types with valid configs', () => {
    expect(() => validateSectionConfigs([{
      zone: 'main',
      rows: [{
        sections: [
          { type: 'divider', config: {} },
          { type: 'heading', config: { level: 2, text: 'Hello' } },
          { type: 'paragraph', config: { html: '<p>body</p>' } },
        ],
      }],
    }])).not.toThrow();
  });
});

describe('validateSectionConfigs — unknown types', () => {
  it('rejects an unknown section type with a structured 400 error', () => {
    let caught: { statusCode?: number; data?: { code?: string; sectionErrors?: Array<{ type: string; issues: Array<{ message: string }> }> } } | undefined;
    try {
      validateSectionConfigs([{
        zone: 'main',
        rows: [{ sections: [{ type: 'does-not-exist', config: {} }] }],
      }]);
    } catch (e) {
      caught = e as typeof caught;
    }
    expect(caught).toBeDefined();
    expect(caught?.statusCode).toBe(400);
    expect(caught?.data?.code).toBe('SECTION_CONFIG_INVALID');
    expect(caught?.data?.sectionErrors).toHaveLength(1);
    expect(caught?.data?.sectionErrors?.[0]?.type).toBe('does-not-exist');
    expect(caught?.data?.sectionErrors?.[0]?.issues[0]?.message).toContain('Unknown section type');
  });
});

describe('validateSectionConfigs — bulk error reporting', () => {
  it('reports ALL invalid sections, not just the first one', () => {
    let caught: { data?: { sectionErrors?: Array<{ type: string }> } } | undefined;
    try {
      validateSectionConfigs([{
        zone: 'main',
        rows: [{
          sections: [
            { type: 'nope-1', config: {} },
            { type: 'nope-2', config: {} },
            { type: 'nope-3', config: {} },
          ],
        }],
      }]);
    } catch (e) {
      caught = e as typeof caught;
    }
    expect(caught?.data?.sectionErrors).toHaveLength(3);
    expect(caught?.data?.sectionErrors?.map((e) => e.type)).toEqual(['nope-1', 'nope-2', 'nope-3']);
  });

  it('preserves zone/row/section position info in each error', () => {
    let caught: { data?: { sectionErrors?: Array<{ zone: string; rowIndex: number; sectionIndex: number }> } } | undefined;
    try {
      validateSectionConfigs([
        {
          zone: 'sidebar',
          rows: [
            { sections: [{ type: 'bad', config: {} }] },
            { sections: [{ type: 'bad', config: {} }, { type: 'bad', config: {} }] },
          ],
        },
      ]);
    } catch (e) {
      caught = e as typeof caught;
    }
    const errs = caught?.data?.sectionErrors ?? [];
    expect(errs).toHaveLength(3);
    expect(errs[0]).toMatchObject({ zone: 'sidebar', rowIndex: 0, sectionIndex: 0 });
    expect(errs[1]).toMatchObject({ zone: 'sidebar', rowIndex: 1, sectionIndex: 0 });
    expect(errs[2]).toMatchObject({ zone: 'sidebar', rowIndex: 1, sectionIndex: 1 });
  });
});

describe('validateSectionConfigs — per-section enforcement (the actual win)', () => {
  it('rejects a cta with a javascript: button href (URL guard)', () => {
    let caught: { data?: { sectionErrors?: Array<{ type: string; issues: Array<{ message: string }> }> } } | undefined;
    try {
      validateSectionConfigs([{
        zone: 'main',
        rows: [{
          sections: [{
            type: 'cta',
            config: { buttons: [{ label: 'Bad', href: 'javascript:alert(1)' }] },
          }],
        }],
      }]);
    } catch (e) {
      caught = e as typeof caught;
    }
    expect(caught?.data?.sectionErrors).toHaveLength(1);
    expect(caught?.data?.sectionErrors?.[0]?.type).toBe('cta');
  });

  it('rejects a gallery with 21 images (.max(20) bound)', () => {
    const tooMany = Array.from({ length: 21 }, () => ({ src: 'https://x/y.png' }));
    let caught: { data?: { sectionErrors?: Array<unknown> } } | undefined;
    try {
      validateSectionConfigs([{
        zone: 'main',
        rows: [{ sections: [{ type: 'gallery', config: { images: tooMany } }] }],
      }]);
    } catch (e) {
      caught = e as typeof caught;
    }
    expect(caught?.data?.sectionErrors).toHaveLength(1);
  });

  it('rejects a heading with text > 240 chars', () => {
    let caught: { data?: { sectionErrors?: Array<unknown> } } | undefined;
    try {
      validateSectionConfigs([{
        zone: 'main',
        rows: [{ sections: [{ type: 'heading', config: { text: 'x'.repeat(241) } }] }],
      }]);
    } catch (e) {
      caught = e as typeof caught;
    }
    expect(caught?.data?.sectionErrors).toHaveLength(1);
  });

  it('rejects an embed with a relative (/) path (strict http(s)-only)', () => {
    let caught: { data?: { sectionErrors?: Array<unknown> } } | undefined;
    try {
      validateSectionConfigs([{
        zone: 'main',
        rows: [{ sections: [{ type: 'embed', config: { url: '/local/path' } }] }],
      }]);
    } catch (e) {
      caught = e as typeof caught;
    }
    expect(caught?.data?.sectionErrors).toHaveLength(1);
  });

  it('rejects content-feed with sort="random" (unknown enum)', () => {
    let caught: { data?: { sectionErrors?: Array<unknown> } } | undefined;
    try {
      validateSectionConfigs([{
        zone: 'main',
        rows: [{ sections: [{ type: 'content-feed', config: { sort: 'random' } }] }],
      }]);
    } catch (e) {
      caught = e as typeof caught;
    }
    expect(caught?.data?.sectionErrors).toHaveLength(1);
  });
});
