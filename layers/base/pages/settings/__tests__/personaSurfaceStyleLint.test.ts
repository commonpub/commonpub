/**
 * Style lint over the two persona-facing settings pages.
 *
 * WHY THIS EXISTS. A browser pass on `/settings/profile/questions` and
 * `/settings/privacy` found six different gaps between sibling blocks on one
 * page (32/44/56/57/77/92px). No rule anywhere set those numbers. The cause was
 * that neither page reset the UA default `p { margin-block: 1em }`, and both
 * lay out with `display: flex` + `gap` , which does NOT collapse margins. So
 * every gap was really `gap + 1em + 1em`, and because `1em` follows each
 * element's own font-size, elements at 10px, 12px and 13px produced a different
 * gap each. Nothing looked wrong in the source; it only showed in a browser.
 *
 * The same pass found 30 hardcoded pixel font-sizes across the two files, which
 * is why the type matched no theme's scale: `theme-studio` generates
 * `--text-*` per instance, and a literal opts out of that silently.
 *
 * Neither defect can fail a unit test that renders a component, because both
 * are cascade behaviour rather than output. This file reads the source instead.
 *
 * A SCANNING TEST NEEDS ITS OWN GUARD (the house rule these pages' sibling
 * `personaCopyLint.test.ts` already follows): a wrong path reads zero files and
 * passes green. Every sweep below asserts the corpus it walked is real, and a
 * positive control proves the extractor returns the style block rather than an
 * empty string.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = resolve(here, '../..');

const PAGES = [
  'settings/profile/questions.vue',
  'settings/privacy.vue',
  // The operator screen carried the identical defect: 53 gaps rendering at 26px
  // instead of 8px. Found by re-scanning for the CLASS after fixing the two
  // member-facing pages, rather than by assuming those were all of it.
  'admin/persona.vue',
] as const;

interface Page { name: string; raw: string; style: string }

/** The `<style scoped>` block with CSS comments removed. */
function styleOf(raw: string): string {
  const open = raw.indexOf('<style scoped>');
  if (open === -1) return '';
  const body = raw.slice(open + '<style scoped>'.length);
  const close = body.lastIndexOf('</style>');
  return (close === -1 ? body : body.slice(0, close)).replace(/\/\*[\s\S]*?\*\//g, '');
}

const pages: Page[] = PAGES.map((name) => {
  const raw = readFileSync(resolve(pagesDir, name), 'utf8');
  return { name, raw, style: styleOf(raw) };
});

describe('persona surface style lint — the guard on the guard', () => {
  it('read both pages, and both are substantial', () => {
    expect(pages).toHaveLength(3);
    for (const p of pages) expect(p.raw.length, p.name).toBeGreaterThan(2000);
  });

  it('positive control: the extractor returns the style block, not an empty string', () => {
    for (const p of pages) {
      expect(p.style.length, p.name).toBeGreaterThan(500);
      expect(p.style, p.name).toContain('display: flex');
    }
  });

  it('positive control: the comment stripper removes a CSS comment and only that', () => {
    const stripped = styleOf('<style scoped>.a{color:red}/* drop */.b{color:blue}</style>');
    expect(stripped).toContain('.a');
    expect(stripped).toContain('.b');
    expect(stripped).not.toContain('drop');
  });
});

describe('persona surface style lint — type comes from the theme', () => {
  /**
   * Every `font-size` value declared, trimmed.
   *
   * Collected and inspected rather than matched with a negative lookahead:
   * `/font-size:\s*(?!var\()/` backtracks `\s*` to zero characters and so
   * matches `font-size: var(--x)`, flagging every correct declaration. That
   * exact trap is documented in `personaCopyLint.test.ts`.
   */
  function fontSizes(style: string): string[] {
    const out: string[] = [];
    for (const m of style.matchAll(/(?:^|[;{\s])font-size\s*:([^;}]*)/g)) {
      out.push((m[1] ?? '').trim());
    }
    return out;
  }

  it.each(PAGES)('%s declares every font-size through a token', (name) => {
    const page = pages.find((p) => p.name === name)!;
    const sizes = fontSizes(page.style);
    // The guard: a page with no font-size at all would pass vacuously.
    expect(sizes.length, `${name} declares no font-size at all`).toBeGreaterThan(5);
    for (const value of sizes) {
      expect(value.startsWith('var('), `${name} hardcodes font-size: ${value}`).toBe(true);
    }
  });

  it('the token scale is instance-generated, which is what a literal opts out of', () => {
    // Not decoration: `theme-studio` emits --text-* from the operator's recipe,
    // so a literal px is not "the same size", it is a different size on every
    // instance that tunes its scale.
    const generator = readFileSync(
      resolve(here, '../../../../../packages/theme-studio/src/generate.ts'),
      'utf8',
    );
    expect(generator).toContain('typeScale');
  });
});

describe('persona surface style lint — spacing is the gap, not stray margins', () => {
  /**
   * The reset that stops the UA paragraph margin reaching a flex `gap`.
   * Matched loosely on purpose: what matters is that the page zeroes the block
   * elements it lays out, not the exact selector spelling.
   */
  const RESET = /:is\(([^)]*\bp\b[^)]*)\)\s*\{\s*margin:\s*0/;

  it.each(PAGES)('%s resets the UA margin on the elements it lays out', (name) => {
    const page = pages.find((p) => p.name === name)!;
    const match = page.style.match(RESET);
    expect(match, `${name} has no margin reset, so gap + 1em + 1em returns`).not.toBeNull();
    // Headings stack into the same flex flow and carry a UA margin too.
    expect(match![1]).toContain('h3');
  });

  it.each(PAGES)('%s lays its column out with gap, which is what the reset protects', (name) => {
    const page = pages.find((p) => p.name === name)!;
    expect(page.style).toMatch(/display:\s*flex/);
    expect(page.style).toMatch(/gap:\s*var\(--space-/);
  });

  it('the questions page groups its lede, so a heading is nearer its text than the next block', () => {
    // Equal spacing everywhere removes the only signal that a heading owns the
    // lines under it. Two steps, not one.
    const page = pages.find((p) => p.name === 'settings/profile/questions.vue')!;
    expect(page.raw).toContain('cpub-questions-lede');
    expect(page.style).toMatch(/\.cpub-questions-lede\s*\{[^}]*gap:\s*var\(--space-2\)/);
  });
});

/** The two member-facing pages carry long reading copy; the admin screen is a
 *  dense operator table and is deliberately not measure-capped. */
const PROSE_PAGES = PAGES.filter((n) => n !== 'admin/persona.vue');

describe('persona surface style lint — measure', () => {
  it.each(PROSE_PAGES)('%s caps the reading measure in ch, so it holds at any scale', (name) => {
    const page = pages.find((p) => p.name === name)!;
    // 720px of 13px text ran to ~96 characters a line against a 45-75 target.
    // The bound is 55, not the customary 65. `1ch` is the width of "0", wider
    // than the average character, so a `ch` cap buys ~25% more characters than
    // its number suggests: 65ch measured ~78 per line and 58ch ~74. The shipped
    // value (52ch) measured ~65. An edit back up to 65ch should fail here
    // rather than quietly widen the copy again.
    const caps = [...page.style.matchAll(/max-width:\s*(\d+)ch/g)].map((m) => Number(m[1]));
    expect(caps.length, `${name} caps no measure`).toBeGreaterThan(0);
    for (const c of caps) expect(c).toBeLessThanOrEqual(55);
  });
});
