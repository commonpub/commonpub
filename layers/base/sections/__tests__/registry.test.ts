/**
 * Layer-level section registry smoke tests.
 *
 * The class-level tests live in `packages/ui/src/__tests__/sections.test.ts`
 * (those cover register/get/list/byCategory/snapshot/colSpan-validation).
 *
 * This file pins the LAYER'S registration of built-in sections — the
 * single source of truth for "what sections does CommonPub ship with".
 * Phase 1c added 5 more entries (hero/heading/paragraph/image/content-feed)
 * to the proof-of-life `divider` from session 157.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
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

  // --- Phase 1c starter catalog -------------------------------------------

  it('Phase 1c starter sections (hero, heading, paragraph, image, content-feed) are registered', () => {
    const reg = useSectionRegistry();
    for (const type of ['hero', 'heading', 'paragraph', 'image', 'content-feed']) {
      expect(reg.has(type), `${type} should be registered`).toBe(true);
    }
  });

  it('hero section: layout category, min 6 / default 12 / resizable', () => {
    const def = useSectionRegistry().get('hero')!;
    expect(def.category).toBe('layout');
    expect(def.minColSpan).toBe(6);
    expect(def.maxColSpan).toBe(12);
    expect(def.defaultColSpan).toBe(12);
    expect(def.resizable).toBe(true);
    expect(def.defaultConfig).toMatchObject({ variant: 'default', title: expect.any(String) });
  });

  it('heading section: content category, min 3, level enum 1-4', () => {
    const def = useSectionRegistry().get('heading')!;
    expect(def.category).toBe('content');
    expect(def.minColSpan).toBe(3);
    // Each valid level parses; level 5 rejects (zod literal union)
    for (const level of [1, 2, 3, 4]) {
      expect(def.configSchema.safeParse({ ...def.defaultConfig, level }).success).toBe(true);
    }
    expect(def.configSchema.safeParse({ ...def.defaultConfig, level: 5 }).success).toBe(false);
  });

  it('paragraph section: content category, default 6 col, text length cap', () => {
    const def = useSectionRegistry().get('paragraph')!;
    expect(def.category).toBe('content');
    expect(def.defaultColSpan).toBe(6);
    expect(def.configSchema.safeParse({ text: 'a'.repeat(8001), align: 'left' }).success).toBe(false);
    expect(def.configSchema.safeParse({ text: 'a'.repeat(100), align: 'left' }).success).toBe(true);
  });

  it('image section: aspect + fit enums; href optional empty string OK', () => {
    const def = useSectionRegistry().get('image')!;
    expect(def.configSchema.safeParse({
      src: 'https://example.com/x.png', alt: '', caption: '', href: '',
      fit: 'cover', aspectRatio: '16/9',
    }).success).toBe(true);
    expect(def.configSchema.safeParse({
      src: '', alt: '', caption: '', href: '',
      fit: 'stretch', aspectRatio: 'auto',
    }).success).toBe(false);
  });

  it('content-feed section: data category, limit clamped 1-24, columns 1-4 only', () => {
    const def = useSectionRegistry().get('content-feed')!;
    expect(def.category).toBe('data');
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 0 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 25 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 12 }).success).toBe(true);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, columns: 5 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, columns: 2 }).success).toBe(true);
  });

  it('every registered section: defaultConfig passes configSchema (round-trip safe)', () => {
    const reg = useSectionRegistry();
    for (const def of reg.list()) {
      const result = def.configSchema.safeParse(def.defaultConfig);
      expect(result.success, `${def.type} defaultConfig should parse against its own schema`).toBe(true);
    }
  });

  // --- Token discipline ---------------------------------------------------

  it('no hardcoded colors in any registered section component (CLAUDE.md rule #3)', () => {
    // Read every Section*.vue file and scan its scoped <style> block for
    // literal colors. var(--*) is the only sanctioned form. Per memory
    // `feedback_prose_style_leak` + `feedback_universal_radius_leak`,
    // hardcoded colors are how non-zero --radius / dark-mode themes leak.
    const sectionsDir = resolve(__dirname, '../../components/sections');
    const files = readdirSync(sectionsDir).filter((f) => f.endsWith('.vue'));
    expect(files.length).toBeGreaterThanOrEqual(6);  // divider + 5 starters

    const offenders: Array<{ file: string; match: string }> = [];
    for (const file of files) {
      const src = readFileSync(resolve(sectionsDir, file), 'utf8');
      const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
      if (!styleMatch) continue;
      const style = styleMatch[1];

      // hex literals (#fff, #ffffff, #ffffffaa)
      const hex = style.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (hex) offenders.push(...hex.map((m) => ({ file, match: m })));

      // rgb/rgba/hsl/hsla literal calls (var(...) wrapping a token is fine)
      const fnLits = style.match(/\b(rgb|rgba|hsl|hsla|oklch)\s*\(/g);
      if (fnLits) offenders.push(...fnLits.map((m) => ({ file, match: m })));
    }
    expect(offenders, `Hardcoded colors leak in: ${JSON.stringify(offenders)}`).toEqual([]);
  });
});
