/**
 * Section registry coverage — the contract everything downstream of
 * Phase 1 depends on (Phase 3 editor, Phase 6 catalogue, Phase 9
 * code-registered sections). Per plan §10.6.1, the foundation must be
 * thoroughly tested before integration tests are built on top.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineComponent, h } from 'vue';
import {
  SectionRegistry,
  resolveColSpan,
  migrateSectionConfig,
  type SectionDefinition,
} from '../sections';

const NullRenderer = defineComponent({ render() { return h('div'); } });

const heroDef: SectionDefinition<{ title: string; variant: 'default' | 'centered' }> = {
  type: 'hero',
  name: 'Hero',
  description: 'Big banner',
  icon: 'fa-image',
  category: 'layout',
  configSchema: z.object({
    title: z.string(),
    variant: z.enum(['default', 'centered']),
  }),
  defaultConfig: { title: '', variant: 'default' },
  schemaVersion: 1,
  component: NullRenderer,
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};

const paragraphDef: SectionDefinition<{ body: string }> = {
  type: 'paragraph',
  name: 'Paragraph',
  description: 'Body text',
  icon: 'fa-paragraph',
  category: 'content',
  configSchema: z.object({ body: z.string() }),
  defaultConfig: { body: '' },
  schemaVersion: 1,
  component: NullRenderer,
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 6,
  resizable: true,
};

const dividerDef: SectionDefinition<Record<string, never>> = {
  type: 'divider',
  name: 'Divider',
  description: 'Horizontal line',
  icon: 'fa-minus',
  category: 'layout',
  configSchema: z.object({}),
  defaultConfig: {},
  schemaVersion: 1,
  component: NullRenderer,
  minColSpan: 12,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: false,
};

// ---- SectionRegistry ----

describe('SectionRegistry.register', () => {
  it('registers and retrieves a section by type', () => {
    const reg = new SectionRegistry();
    reg.register(heroDef);
    expect(reg.get('hero')?.name).toBe('Hero');
    expect(reg.has('hero')).toBe(true);
    expect(reg.has('paragraph')).toBe(false);
  });

  it('throws on duplicate type registration (fail-fast at startup)', () => {
    const reg = new SectionRegistry();
    reg.register(heroDef);
    expect(() => reg.register(heroDef)).toThrow(/already registered/);
  });

  it('rejects minColSpan out of [1, 12]', () => {
    const reg = new SectionRegistry();
    expect(() => reg.register({ ...heroDef, minColSpan: 0 })).toThrow(/minColSpan/);
    expect(() => reg.register({ ...heroDef, minColSpan: 13 })).toThrow(/minColSpan/);
  });

  it('rejects maxColSpan < minColSpan', () => {
    const reg = new SectionRegistry();
    expect(() => reg.register({ ...heroDef, minColSpan: 8, maxColSpan: 6 })).toThrow(/maxColSpan/);
  });

  it('rejects defaultColSpan outside [minColSpan, maxColSpan]', () => {
    const reg = new SectionRegistry();
    expect(() => reg.register({ ...heroDef, defaultColSpan: 4 })).toThrow(/defaultColSpan/);
    expect(() => reg.register({ ...heroDef, defaultColSpan: 13 })).toThrow(/maxColSpan|defaultColSpan/);
  });

  it('returns null on unregistered type', () => {
    const reg = new SectionRegistry();
    expect(reg.get('does-not-exist')).toBeNull();
  });
});

describe('SectionRegistry.list / byCategory', () => {
  it('list returns all registered defs', () => {
    const reg = new SectionRegistry();
    reg.register(heroDef);
    reg.register(paragraphDef);
    reg.register(dividerDef);
    expect(reg.list().map((d) => d.type).sort()).toEqual(['divider', 'hero', 'paragraph']);
  });

  it('byCategory buckets correctly', () => {
    const reg = new SectionRegistry();
    reg.register(heroDef);       // layout
    reg.register(paragraphDef);  // content
    reg.register(dividerDef);    // layout
    const grouped = reg.byCategory();
    expect(grouped.layout.map((d) => d.type).sort()).toEqual(['divider', 'hero']);
    expect(grouped.content.map((d) => d.type)).toEqual(['paragraph']);
    expect(grouped.data).toEqual([]);
    expect(grouped.embed).toEqual([]);
  });

  it('clear empties the registry (test helper)', () => {
    const reg = new SectionRegistry();
    reg.register(heroDef);
    expect(reg.list()).toHaveLength(1);
    reg.clear();
    expect(reg.list()).toHaveLength(0);
  });
});

describe('SectionRegistry.snapshot', () => {
  it('returns a serialisable subset (no Vue Component, no Zod schema)', () => {
    const reg = new SectionRegistry();
    reg.register(heroDef);
    const snap = reg.snapshot();
    expect(snap).toHaveLength(1);
    const h0 = snap[0]!;
    expect(h0.type).toBe('hero');
    expect(h0.name).toBe('Hero');
    expect(h0.minColSpan).toBe(6);
    // Component + configSchema MUST NOT leak into the JSON payload
    expect(h0).not.toHaveProperty('component');
    expect(h0).not.toHaveProperty('configSchema');
    expect(JSON.stringify(snap)).not.toContain('NullRenderer');
  });
});

// ---- resolveColSpan ----

describe('resolveColSpan', () => {
  it('lg viewport returns lg override, else base', () => {
    expect(resolveColSpan(6, { lg: 8 }, 'lg')).toBe(8);
    expect(resolveColSpan(6, undefined, 'lg')).toBe(6);
  });

  it('md viewport falls through md → lg → base', () => {
    expect(resolveColSpan(6, { md: 4 }, 'md')).toBe(4);
    expect(resolveColSpan(6, { lg: 8 }, 'md')).toBe(8);          // md unset → lg
    expect(resolveColSpan(6, {}, 'md')).toBe(6);                  // both unset → base
  });

  it('sm viewport defaults to 12 (rows stack on mobile) unless explicitly overridden', () => {
    // The chain doc-string promise: "Mobile default is 12 unless explicitly
    // overridden somewhere in the chain". Test it.
    expect(resolveColSpan(6, undefined, 'sm')).toBe(12);
    expect(resolveColSpan(6, {}, 'sm')).toBe(12);
    expect(resolveColSpan(6, { sm: 6 }, 'sm')).toBe(6);
  });
});

// ---- migrateSectionConfig ----

describe('migrateSectionConfig', () => {
  it('returns config unchanged when stored version matches current', () => {
    const result = migrateSectionConfig(heroDef, { title: 'X', variant: 'default' }, 1);
    expect(result).toEqual({ config: { title: 'X', variant: 'default' }, version: 1 });
  });

  it('returns config unchanged when stored version is AHEAD of current (downgrade unsupported)', () => {
    const result = migrateSectionConfig(heroDef, { title: 'X', variant: 'default' }, 5);
    expect(result.version).toBe(5);
    expect(result.warning).toBeUndefined();
  });

  it('runs a single-step migration', () => {
    const v2Def: SectionDefinition<{ headline: string }> = {
      ...heroDef,
      schemaVersion: 2,
      defaultConfig: { headline: '' } as never,
      configSchema: z.object({ headline: z.string() }) as never,
      migrations: {
        2: (old) => ({ headline: (old.title as string | undefined) ?? '' }),
      },
    };
    const result = migrateSectionConfig(v2Def, { title: 'Old title' }, 1);
    expect(result.version).toBe(2);
    expect(result.config).toEqual({ headline: 'Old title' });
    expect(result.warning).toBeUndefined();
  });

  it('runs a multi-step migration chain', () => {
    // The migrations Record<number, fn -> TConfig> is strictly typed, but
    // intermediate migration steps produce intermediate shapes — they're only
    // type-safe IN AGGREGATE once the chain completes. The `as never` cast on
    // intermediate steps mirrors the same escape used for defaultConfig +
    // configSchema above (vue-tsc strict mode catches this where vitest
    // doesn't — caught when CI ran the repo's `vue-tsc --noEmit` step).
    const v3Def: SectionDefinition<{ headline: string; subline: string }> = {
      ...heroDef,
      schemaVersion: 3,
      defaultConfig: { headline: '', subline: '' } as never,
      configSchema: z.object({ headline: z.string(), subline: z.string() }) as never,
      migrations: {
        2: ((old: Record<string, unknown>) => ({ headline: (old.title as string | undefined) ?? '' })) as never,
        3: ((old: Record<string, unknown>) => ({ headline: old.headline as string, subline: '' })) as never,
      },
    };
    const result = migrateSectionConfig(v3Def, { title: 'Old title' }, 1);
    expect(result.version).toBe(3);
    expect(result.config).toEqual({ headline: 'Old title', subline: '' });
  });

  it('halts with a warning when a migration step is missing', () => {
    const v3Def: SectionDefinition<{ headline: string; subline: string }> = {
      ...heroDef,
      schemaVersion: 3,
      defaultConfig: { headline: '', subline: '' } as never,
      configSchema: z.object({ headline: z.string(), subline: z.string() }) as never,
      // step 2 present, step 3 missing — see comment in chain test above
      migrations: {
        2: ((old: Record<string, unknown>) => ({ headline: (old.title as string | undefined) ?? '' })) as never,
      },
    };
    const result = migrateSectionConfig(v3Def, { title: 'X' }, 1);
    expect(result.version).toBe(2);  // halted at the last completable step
    expect(result.config).toEqual({ headline: 'X' });
    expect(result.warning).toMatch(/missing migration to version 3/);
  });
});
