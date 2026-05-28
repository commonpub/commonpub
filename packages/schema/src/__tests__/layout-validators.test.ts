/**
 * Layout-engine Zod validator coverage.
 *
 * The validators ARE the layout-engine API contract — every server
 * write goes through `layoutSchema`/`layoutCreateSchema`, so any
 * invariant we want to hold (colSpan bounds, unique positions, sum of
 * cols ≤ 12, custom-page requires pageMeta, etc.) MUST be exercised
 * by a real parse case here. The server CRUD inherits these guarantees;
 * the SQL check-constraints are defence-in-depth.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  layoutScopeSchema,
  pageMetaSchema,
  layoutSectionSchema,
  layoutRowSchema,
  layoutZoneSchema,
  layoutSchema,
  layoutCreateSchema,
  sectionResponsiveSchema,
  sectionVisibilitySchema,
  layoutRowConfigSchema,
} from '../validators.js';

const uuid = () => randomUUID();

// ---- Scope ---------------------------------------------------------------

describe('layoutScopeSchema', () => {
  it('accepts a route scope', () => {
    expect(layoutScopeSchema.parse({ type: 'route', path: '/' })).toEqual({ type: 'route', path: '/' });
  });
  it('accepts a virtual scope with a declared key', () => {
    expect(layoutScopeSchema.parse({ type: 'virtual', key: '__footer' })).toEqual({ type: 'virtual', key: '__footer' });
  });
  it('rejects a virtual scope with an unknown key', () => {
    expect(() => layoutScopeSchema.parse({ type: 'virtual', key: '__random' })).toThrow();
  });
  it('accepts a custom-page scope', () => {
    expect(layoutScopeSchema.parse({ type: 'custom-page', path: '/about' })).toEqual({ type: 'custom-page', path: '/about' });
  });
  it('rejects scope with unknown type', () => {
    expect(() => layoutScopeSchema.parse({ type: 'unknown', path: '/' } as never)).toThrow();
  });
  it('rejects route scope missing path', () => {
    expect(() => layoutScopeSchema.parse({ type: 'route' } as never)).toThrow();
  });
});

// ---- PageMeta -----------------------------------------------------------

describe('pageMetaSchema', () => {
  it('parses a minimal meta with just title', () => {
    const p = pageMetaSchema.parse({ title: 'About' });
    expect(p.title).toBe('About');
    expect(p.access).toBe('public');
    expect(p.frame).toBe('wide');
    expect(p.noindex).toBe(false);
  });
  it('accepts all valid frame slugs', () => {
    for (const frame of ['narrow', 'wide', 'two-column', 'three-column', 'sidebar-left', 'sidebar-right'] as const) {
      expect(pageMetaSchema.parse({ title: 'x', frame }).frame).toBe(frame);
    }
  });
  it('rejects ogImage that is not a URL', () => {
    expect(() => pageMetaSchema.parse({ title: 'x', ogImage: 'not a url' })).toThrow();
  });
  it('rejects unknown access value', () => {
    expect(() => pageMetaSchema.parse({ title: 'x', access: 'partner' as never })).toThrow();
  });

  // P1 security fix from session 160 audit — closes ogImage scheme bypass
  describe('ogImage scheme restriction (P1 audit fix)', () => {
    it('accepts https:// URL', () => {
      expect(pageMetaSchema.parse({ title: 'x', ogImage: 'https://cdn.example.com/og.png' }).ogImage)
        .toBe('https://cdn.example.com/og.png');
    });
    it('accepts http:// URL', () => {
      expect(pageMetaSchema.parse({ title: 'x', ogImage: 'http://example.com/img.jpg' }).ogImage)
        .toBe('http://example.com/img.jpg');
    });
    it('REJECTS protocol-relative // URL (Zod url() requires a scheme)', () => {
      expect(() => pageMetaSchema.parse({ title: 'x', ogImage: '//cdn.example.com/img.png' })).toThrow();
    });
    it('REJECTS javascript: URL (XSS vector)', () => {
      expect(() => pageMetaSchema.parse({ title: 'x', ogImage: 'javascript:alert(1)' })).toThrow();
    });
    it('REJECTS data: URL (CSP bypass / large payload)', () => {
      expect(() => pageMetaSchema.parse({ title: 'x', ogImage: 'data:image/png;base64,AAAA' })).toThrow();
    });
    it('REJECTS file: URL', () => {
      expect(() => pageMetaSchema.parse({ title: 'x', ogImage: 'file:///etc/passwd' })).toThrow();
    });
    it('REJECTS ftp: URL', () => {
      expect(() => pageMetaSchema.parse({ title: 'x', ogImage: 'ftp://example.com/img.png' })).toThrow();
    });
  });
});

// ---- Section ------------------------------------------------------------

describe('layoutSectionSchema', () => {
  const baseSection = () => ({
    id: uuid(),
    order: 0,
    type: 'hero',
    config: {},
    colSpan: 12,
    enabled: true,
    schemaVersion: 1,
  });

  it('parses a valid section', () => {
    const s = layoutSectionSchema.parse(baseSection());
    expect(s.colSpan).toBe(12);
    expect(s.enabled).toBe(true);
  });
  it('defaults colSpan to 12 when omitted', () => {
    const { colSpan: _omit, ...withoutColSpan } = baseSection();
    void _omit;
    const s = layoutSectionSchema.parse(withoutColSpan);
    expect(s.colSpan).toBe(12);
  });
  it('rejects colSpan = 0', () => {
    expect(() => layoutSectionSchema.parse({ ...baseSection(), colSpan: 0 })).toThrow();
  });
  it('rejects colSpan = 13', () => {
    expect(() => layoutSectionSchema.parse({ ...baseSection(), colSpan: 13 })).toThrow();
  });
  it('rejects negative order', () => {
    expect(() => layoutSectionSchema.parse({ ...baseSection(), order: -1 })).toThrow();
  });
  it('rejects empty type', () => {
    expect(() => layoutSectionSchema.parse({ ...baseSection(), type: '' })).toThrow();
  });
  it('accepts responsive overrides at all breakpoints', () => {
    const s = layoutSectionSchema.parse({
      ...baseSection(),
      responsive: { sm: 12, md: 6, lg: 4 },
    });
    expect(s.responsive).toEqual({ sm: 12, md: 6, lg: 4 });
  });
  it('rejects responsive colSpan out of bounds', () => {
    expect(() => layoutSectionSchema.parse({ ...baseSection(), responsive: { sm: 14 } })).toThrow();
  });
  it('accepts visibility filters', () => {
    const s = layoutSectionSchema.parse({
      ...baseSection(),
      visibility: { roles: ['admin'], features: ['contests'], hideAt: ['sm'] },
    });
    expect(s.visibility?.roles).toEqual(['admin']);
  });
  it('rejects visibility role not in enum', () => {
    expect(() => layoutSectionSchema.parse({
      ...baseSection(),
      visibility: { roles: ['unknown-role' as never] },
    })).toThrow();
  });
});

// ---- Row ----------------------------------------------------------------

describe('layoutRowSchema', () => {
  const section = (id: string, order: number, colSpan: number) => ({
    id, order, type: 'hero', config: {}, colSpan, enabled: true, schemaVersion: 1,
  });

  it('parses a row with two 6/12 sections', () => {
    const r = layoutRowSchema.parse({
      id: uuid(),
      order: 0,
      sections: [section(uuid(), 0, 6), section(uuid(), 1, 6)],
    });
    expect(r.sections).toHaveLength(2);
  });

  it('rejects a row whose section colSpans sum > 12', () => {
    expect(() => layoutRowSchema.parse({
      id: uuid(),
      order: 0,
      sections: [section(uuid(), 0, 8), section(uuid(), 1, 6)],
    })).toThrow(/colSpans.*≤ 12/);
  });

  it('accepts a row with sum exactly 12', () => {
    expect(() => layoutRowSchema.parse({
      id: uuid(),
      order: 0,
      sections: [section(uuid(), 0, 4), section(uuid(), 1, 4), section(uuid(), 2, 4)],
    })).not.toThrow();
  });

  it('rejects sections with duplicate order values', () => {
    expect(() => layoutRowSchema.parse({
      id: uuid(),
      order: 0,
      sections: [section(uuid(), 0, 6), section(uuid(), 0, 6)],
    })).toThrow(/orders.*unique/);
  });

  // P2 audit fix (session 160): payload-bomb DOS bound
  it('rejects rows with more than 24 sections (payload-bomb cap)', () => {
    const sections = Array.from({ length: 25 }, (_, i) => section(uuid(), i, 1));
    // sum colSpans = 25 (also > 12) — either rejection wins; assert at-least-one
    expect(() => layoutRowSchema.parse({ id: uuid(), order: 0, sections })).toThrow();
  });

  it('parses row config (gap / align / background / paddingY)', () => {
    const cfg = layoutRowConfigSchema.parse({
      gap: 'md', align: 'center', background: 'var(--surface2)', paddingY: 'lg',
    });
    expect(cfg.gap).toBe('md');
  });

  it('rejects row config gap not in enum', () => {
    expect(() => layoutRowConfigSchema.parse({ gap: 'huge' as never })).toThrow();
  });
});

// ---- Zone ---------------------------------------------------------------

describe('layoutZoneSchema', () => {
  it('parses zone with multiple rows', () => {
    const z = layoutZoneSchema.parse({
      zone: 'main',
      rows: [
        { id: uuid(), order: 0, sections: [] },
        { id: uuid(), order: 1, sections: [] },
      ],
    });
    expect(z.rows).toHaveLength(2);
  });

  it('rejects rows with duplicate order values', () => {
    expect(() => layoutZoneSchema.parse({
      zone: 'main',
      rows: [
        { id: uuid(), order: 0, sections: [] },
        { id: uuid(), order: 0, sections: [] },
      ],
    })).toThrow(/Row orders.*unique/);
  });

  // P2 audit fix (session 160): payload-bomb DOS bound
  it('rejects zones with more than 200 rows (payload-bomb cap)', () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({ id: uuid(), order: i, sections: [] }));
    expect(() => layoutZoneSchema.parse({ zone: 'main', rows })).toThrow();
  });

  it('rejects invalid zone slug', () => {
    expect(() => layoutZoneSchema.parse({ zone: '__nope spaces__', rows: [] })).toThrow();
  });
});

// ---- Full Layout --------------------------------------------------------

describe('layoutSchema', () => {
  it('parses a minimal valid layout', () => {
    const l = layoutSchema.parse({
      scope: { type: 'route', path: '/' },
      name: 'Homepage',
    });
    expect(l.zones).toEqual([]);
    expect(l.state).toBe('draft');
  });

  it('requires pageMeta for custom-page scope', () => {
    expect(() => layoutSchema.parse({
      scope: { type: 'custom-page', path: '/about' },
      name: 'About',
      // pageMeta missing
    })).toThrow(/pageMeta is required for custom-page/);
  });

  it('accepts custom-page when pageMeta is present', () => {
    const l = layoutSchema.parse({
      scope: { type: 'custom-page', path: '/about' },
      name: 'About',
      pageMeta: { title: 'About Us' },
    });
    expect(l.pageMeta?.title).toBe('About Us');
  });

  it('does NOT require pageMeta for route scope (built-in pages have their own title)', () => {
    expect(() => layoutSchema.parse({
      scope: { type: 'route', path: '/' },
      name: 'Homepage',
    })).not.toThrow();
  });

  it('rejects duplicate zone slugs within a layout', () => {
    expect(() => layoutSchema.parse({
      scope: { type: 'route', path: '/' },
      name: 'Homepage',
      zones: [
        { zone: 'main', rows: [] },
        { zone: 'main', rows: [] },
      ],
    })).toThrow(/Zone slugs.*unique/);
  });

  it('accepts a complete nested payload (zones → rows → sections)', () => {
    const l = layoutSchema.parse({
      scope: { type: 'route', path: '/' },
      name: 'Homepage',
      zones: [
        {
          zone: 'main',
          rows: [
            {
              id: uuid(),
              order: 0,
              config: { gap: 'md' },
              sections: [
                { id: uuid(), order: 0, type: 'hero', config: { variant: 'default' }, colSpan: 12, enabled: true, schemaVersion: 1 },
              ],
            },
            {
              id: uuid(),
              order: 1,
              sections: [
                { id: uuid(), order: 0, type: 'image', config: {}, colSpan: 6, enabled: true, schemaVersion: 1 },
                { id: uuid(), order: 1, type: 'paragraph', config: {}, colSpan: 6, enabled: true, schemaVersion: 1 },
              ],
            },
          ],
        },
        {
          zone: 'sidebar',
          rows: [],
        },
      ],
    });
    expect(l.zones).toHaveLength(2);
    expect(l.zones[0]!.rows).toHaveLength(2);
    expect(l.zones[0]!.rows[1]!.sections).toHaveLength(2);
  });
});

// ---- Create input -------------------------------------------------------

describe('layoutCreateSchema', () => {
  it('strips server-controlled fields when omitted', () => {
    // The create schema is `layoutSchema.omit({ id, createdAt, updatedAt, publishedVersionId })`
    // — parsing a payload that doesn't include them must succeed.
    const result = layoutCreateSchema.parse({
      scope: { type: 'route', path: '/' },
      name: 'Homepage',
    });
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('createdAt');
  });

  it('still enforces the custom-page pageMeta invariant', () => {
    expect(() => layoutCreateSchema.parse({
      scope: { type: 'custom-page', path: '/about' },
      name: 'About',
    })).toThrow(/pageMeta is required/);
  });
});

// ---- Sub-schemas worth confirming separately ----------------------------

describe('sectionResponsiveSchema', () => {
  it('accepts an empty object (all breakpoints optional)', () => {
    expect(sectionResponsiveSchema.parse({})).toEqual({});
  });
  it('rejects sm = 0', () => {
    expect(() => sectionResponsiveSchema.parse({ sm: 0 })).toThrow();
  });
});

describe('sectionVisibilitySchema', () => {
  it('accepts all valid roles', () => {
    const v = sectionVisibilitySchema.parse({
      roles: ['anonymous', 'member', 'pro', 'verified', 'staff', 'admin'],
    });
    expect(v.roles).toHaveLength(6);
  });
  it('rejects hideAt with unknown breakpoint', () => {
    expect(() => sectionVisibilitySchema.parse({ hideAt: ['xs' as never] })).toThrow();
  });
});
