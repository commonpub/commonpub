/**
 * Layer-level section registry smoke tests.
 *
 * The class-level tests live in `packages/ui/src/__tests__/sections.test.ts`
 * (those cover register/get/list/byCategory/snapshot/colSpan-validation).
 *
 * This file pins the LAYER'S registration of built-in sections — the
 * single source of truth for "what sections does CommonPub ship with".
 * Phase 1c will add 5 more entries to the expected list; this test
 * catches accidental removal or rename of the proof-of-life divider
 * section that landed in session 157.
 */
import { describe, it, expect } from 'vitest';
import { useSectionRegistry } from '../registry';

describe('layer section registry — built-in registrations', () => {
  it('exposes a singleton — repeated useSectionRegistry calls return the same instance', () => {
    const a = useSectionRegistry();
    const b = useSectionRegistry();
    expect(a).toBe(b);
  });

  it('registers the divider section (Phase 1 proof-of-life)', () => {
    const reg = useSectionRegistry();
    expect(reg.has('divider')).toBe(true);
    const def = reg.get('divider')!;
    expect(def.type).toBe('divider');
    expect(def.category).toBe('layout');
    expect(def.resizable).toBe(false);  // dividers are always full-width
    expect(def.minColSpan).toBe(12);
    expect(def.maxColSpan).toBe(12);
    expect(def.defaultColSpan).toBe(12);
  });

  it('divider.configSchema validates the default config without error', () => {
    const def = useSectionRegistry().get('divider')!;
    const result = def.configSchema.safeParse(def.defaultConfig);
    expect(result.success).toBe(true);
  });

  it('divider.configSchema rejects an unknown variant', () => {
    const def = useSectionRegistry().get('divider')!;
    const result = def.configSchema.safeParse({ variant: 'wavy', spacingY: 'md' });
    expect(result.success).toBe(false);
  });

  it('divider.configSchema fills defaults when partial', () => {
    const def = useSectionRegistry().get('divider')!;
    const result = def.configSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variant).toBe('solid');
      expect(result.data.spacingY).toBe('md');
    }
  });

  it('Phase 1c expected sections (hero, heading, paragraph, image, content-feed) are NOT YET registered', () => {
    // Negative regression: lock the Phase-1-only state. When Phase 1c
    // adds these, this test gets inverted (each one becomes a positive
    // `has('hero')` etc.) — clear signal of the phase transition.
    const reg = useSectionRegistry();
    expect(reg.has('hero')).toBe(false);
    expect(reg.has('heading')).toBe(false);
    expect(reg.has('paragraph')).toBe(false);
    expect(reg.has('image')).toBe(false);
    expect(reg.has('content-feed')).toBe(false);
  });
});
