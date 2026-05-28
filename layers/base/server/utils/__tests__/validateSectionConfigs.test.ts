/**
 * Tests for the per-section configSchema validator (P1 fix from
 * session 160 audit — closes the "admin bypasses URL guards / size
 * caps / sandbox flags" surface).
 *
 * Uses the layer's REAL section registry (17 registered sections) so
 * tests exercise actual production schemas. A handcrafted-registry
 * harness would test the validator in isolation but hide whether the
 * REAL schemas reject the payloads we care about.
 */
import { describe, it, expect } from 'vitest';
import { validateSectionConfigs } from '../validateSectionConfigs';
import { useSectionRegistry } from '../../../sections/registry';

// Pull the real registry once — the layer's module-load registers all
// builtins synchronously, so this is populated by import time.
const realRegistry = useSectionRegistry();

describe('validateSectionConfigs — happy path with real registry', () => {
  it('passes for empty zones (nothing to validate)', () => {
    expect(() => validateSectionConfigs([], realRegistry)).not.toThrow();
    expect(() => validateSectionConfigs([{ zone: 'main', rows: [] }], realRegistry)).not.toThrow();
  });

  it('passes for a section with valid config (divider — simplest)', () => {
    expect(() => validateSectionConfigs(
      [{
        zone: 'main',
        rows: [{
          sections: [{ type: 'divider', config: {} }],
        }],
      }],
      realRegistry,
    )).not.toThrow();
  });
});

describe('validateSectionConfigs — unknown types', () => {
  it('rejects an unknown section type with a structured 400 error', () => {
    let caught: { statusCode?: number; data?: { code?: string; sectionErrors?: Array<{ type: string; issues: Array<{ message: string }> }> } } | undefined;
    try {
      validateSectionConfigs(
        [{
          zone: 'main',
          rows: [{ sections: [{ type: 'does-not-exist', config: {} }] }],
        }],
        realRegistry,
      );
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
      validateSectionConfigs(
        [{
          zone: 'main',
          rows: [{
            sections: [
              { type: 'nope-1', config: {} },
              { type: 'nope-2', config: {} },
              { type: 'nope-3', config: {} },
            ],
          }],
        }],
        realRegistry,
      );
    } catch (e) {
      caught = e as typeof caught;
    }
    expect(caught?.data?.sectionErrors).toHaveLength(3);
    expect(caught?.data?.sectionErrors?.map((e) => e.type)).toEqual(['nope-1', 'nope-2', 'nope-3']);
  });

  it('preserves zone/row/section position info in each error', () => {
    let caught: { data?: { sectionErrors?: Array<{ zone: string; rowIndex: number; sectionIndex: number }> } } | undefined;
    try {
      validateSectionConfigs(
        [
          {
            zone: 'sidebar',
            rows: [
              { sections: [{ type: 'bad', config: {} }] },
              { sections: [{ type: 'bad', config: {} }, { type: 'bad', config: {} }] },
            ],
          },
        ],
        realRegistry,
      );
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
