/**
 * Copy and structure lint over the persona component tree (plan 10.2's last row
 * and 10.4's copy-lint entry).
 *
 * P7 — A SCANNING TEST NEEDS ITS OWN GUARD. A broken path walks zero files and
 * passes green, which is the most confident-looking failure mode there is. Every
 * sweep below asserts how many files it read, that each was non-empty, and that
 * the extractor found real content (a positive control on a line we know is
 * there). Deleting a component would drop the count below its floor and turn
 * this red rather than quietly shrinking the corpus.
 *
 * Only TEMPLATE text is linted, with HTML comments stripped: comments are
 * exempt from the copy rules, and the doc comments in these components
 * deliberately use em dashes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const componentDir = resolve(here, '..');
const repoRoot = resolve(here, '../../../../..');

/** Every persona component, plus its test, is part of the corpus this guards. */
const componentFiles = readdirSync(componentDir).filter((f) => f.endsWith('.vue')).sort();
const testFiles = readdirSync(here).filter((f) => f.endsWith('.test.ts')).sort();

/** Floors. A deleted component must fail here, not silently shrink the sweep. */
const MIN_COMPONENTS = 6;
const MIN_FILES = 10;

interface Source { name: string; raw: string; template: string }

/** The `<template>` block with HTML comments removed. */
function templateOf(raw: string): string {
  const open = raw.indexOf('<template>');
  const close = raw.lastIndexOf('</template>');
  if (open === -1 || close === -1) return '';
  return raw.slice(open + '<template>'.length, close).replace(/<!--[\s\S]*?-->/g, '');
}

const sources: Source[] = componentFiles.map((name) => {
  const raw = readFileSync(resolve(componentDir, name), 'utf8');
  return { name, raw, template: templateOf(raw) };
});

describe('persona copy lint — the guard on the guard (P7)', () => {
  it('walked every persona component and every persona test', () => {
    expect(componentFiles.length).toBeGreaterThanOrEqual(MIN_COMPONENTS);
    expect(componentFiles.length + testFiles.length).toBeGreaterThanOrEqual(MIN_FILES);
  });

  it('read the six components this feature is built from, by name', () => {
    for (const expected of [
      'PersonaChipGrid.vue',
      'PersonaCompletenessMeter.vue',
      'PersonaFieldInput.vue',
      'PersonaInvitationBanner.vue',
      'PersonaRetiredData.vue',
      'PersonaSectionEditor.vue',
    ]) {
      expect(componentFiles).toContain(expected);
    }
  });

  it('every file it read is non-empty and every template extractor found content', () => {
    for (const s of sources) {
      expect(s.raw.length, s.name).toBeGreaterThan(200);
      expect(s.template.trim().length, s.name).toBeGreaterThan(0);
    }
  });

  it('positive control: the extractor really returns template copy, not the doc comment', () => {
    const meter = sources.find((s) => s.name === 'PersonaCompletenessMeter.vue')!;
    // In the template.
    expect(meter.template).toContain('This is all optional.');
    // In the doc comment, and therefore NOT in the extracted template.
    expect(meter.raw).toContain('NEVER SEEDED TO');
    expect(meter.template).not.toContain('NEVER SEEDED TO');
  });

  it('positive control: the comment stripper removes an HTML comment, and only that', () => {
    const stripped = templateOf('<template><p>keep</p><!-- drop --><p>keep2</p></template>');
    expect(stripped).toContain('keep');
    expect(stripped).toContain('keep2');
    expect(stripped).not.toContain('drop');
  });
});

describe('persona copy lint — user-facing copy', () => {
  it('contains no em dash', () => {
    // An em dash in product copy is the house AI tell. Comments are exempt,
    // which is why only the template is scanned.
    for (const s of sources) expect(s.template, s.name).not.toContain('—');
  });

  const BANNED = [
    // Gamification. Points never unlock anything and never appear here.
    'score', 'streak', 'leaderboard', 'rank', 'badge', 'unlock', 'reward', 'level up',
    // Shaming and urgency.
    'complete your profile', 'finish your profile', 'incomplete', 'don\'t miss', 'hurry',
    // Consent theatre.
    'we value your privacy', 'improve your experience', 'to serve you better',
    // Nothing in the persona is required.
    'required', 'you must',
  ];

  it.each(BANNED)('never says "%s"', (phrase) => {
    for (const s of sources) {
      expect(s.template.toLowerCase(), `${s.name} contains "${phrase}"`).not.toContain(phrase);
    }
  });

  it('uses the exact agreed strings for the load-bearing lines this tree owns', () => {
    const all = sources.map((s) => s.template).join('\n');
    expect(all).toContain('This is all optional. Fill in what you want people to see.');
    expect(all).toContain('This was collected under a question that is no longer part of this profile. You can delete it.');
  });

  it('leaves the editor empty state to the page, so it is never printed twice', () => {
    // "Nothing here yet. Pick whatever you want people to see..." belongs to
    // pages/settings/persona.vue, which renders it above the sections.
    const all = sources.map((s) => s.template).join('\n');
    expect(all).not.toContain('Nothing here yet');
  });
});

describe('persona structure lint', () => {
  it('never fakes a button with a div', () => {
    // A role=button container holding button children is a spec violation this
    // codebase has shipped once already.
    for (const s of sources) expect(s.template, s.name).not.toMatch(/role="button"/);
  });

  it('never uses aria-selected or a listbox, which have role prerequisites chips lack', () => {
    for (const s of sources) {
      expect(s.template, s.name).not.toContain('aria-selected');
      expect(s.template, s.name).not.toContain('role="listbox"');
      expect(s.template, s.name).not.toContain('role="option"');
    }
  });

  it('never uses <details> for a section, whose open state cannot be driven from outside', () => {
    for (const s of sources) expect(s.template, s.name).not.toContain('<details');
  });

  it('never announces assertively', () => {
    // Template only: the doc comments deliberately explain WHY assertive is
    // wrong here, and a raw-source scan would flag its own rationale.
    for (const s of sources) expect(s.template, s.name).not.toContain('aria-live="assertive"');
  });

  it('imports its own children by path, so the auto-import prefix cannot bite', () => {
    // `components/persona/SectionEditor.vue` registers as `<PersonaSectionEditor>`,
    // and a bare `<SectionEditor>` renders EMPTY with no error and no test
    // failure. Path imports are immune.
    const editor = sources.find((s) => s.name === 'PersonaSectionEditor.vue')!;
    expect(editor.raw).toContain("from './PersonaChipGrid.vue'");
    expect(editor.raw).toContain("from './PersonaFieldInput.vue'");
  });
});

describe('persona theme tokens live in packages/ui/theme', () => {
  const cssPath = resolve(repoRoot, 'packages/ui/theme/components.css');
  const css = readFileSync(cssPath, 'utf8');
  const start = css.indexOf('PERSONA (session 255)');
  const block = start === -1 ? '' : css.slice(start);

  it('found the persona block and it is substantial', () => {
    // The guard: a renamed heading would otherwise make every assertion below
    // pass against an empty string.
    expect(start).toBeGreaterThan(0);
    expect(block.split('\n').length).toBeGreaterThan(200);
  });

  it('declares --cpub-chip-min and uses it in the auto-fill track', () => {
    expect(block).toContain('--cpub-chip-min:');
    expect(block).toMatch(/repeat\(auto-fill,\s*minmax\(var\(--cpub-chip-min\),\s*1fr\)\)/);
  });

  const declarations = block.replace(/\/\*[\s\S]*?\*\//g, '');

  /**
   * Every value declared for `prop`, trimmed.
   *
   * NOT a negative lookahead like /font-family:\s*(?!var\()/ : `\s*` backtracks
   * to zero characters, so that pattern matches `font-family: var(--x)` and
   * flags every correct declaration. Collect the values and check them.
   */
  function valuesOf(prop: string): string[] {
    const out: string[] = [];
    for (const m of declarations.matchAll(new RegExp(`(?:^|[;{\\s])${prop}\\s*:([^;}]*)`, 'g'))) {
      out.push((m[1] ?? '').trim());
    }
    return out;
  }

  it('hardcodes no colour', () => {
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(declarations).not.toMatch(/\brgba?\(/);
    expect(declarations).not.toMatch(/\bhsla?\(/);
  });

  it('names no font family outside a token', () => {
    const fonts = valuesOf('font-family');
    expect(fonts.length).toBeGreaterThan(0);
    for (const v of fonts) expect(v.startsWith('var(')).toBe(true);
  });

  it('keeps the house shape: 2px borders, offset shadows with no blur, sharp corners', () => {
    const shadows = valuesOf('box-shadow');
    expect(shadows.length).toBeGreaterThan(0);
    for (const v of shadows) expect(v.startsWith('var(')).toBe(true);
    // Nothing in this block re-rounds a corner: --radius is 0 globally and a
    // literal radius here would be the universal-radius leak all over again.
    expect(valuesOf('border-radius')).toEqual([]);
    expect(declarations).toContain('var(--border-width-default)');
  });

  it('the components carry no scoped colour of their own either', () => {
    for (const s of sources) {
      const styleStart = s.raw.indexOf('<style');
      if (styleStart === -1) continue;
      const style = s.raw.slice(styleStart).replace(/\/\*[\s\S]*?\*\//g, '');
      expect(style, s.name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(style, s.name).not.toMatch(/\brgba?\(/);
    }
  });
});
