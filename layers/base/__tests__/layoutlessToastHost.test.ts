import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A page with `layout: false` renders none of `layouts/default.vue`, and that is
 * where `<AppToast />` is mounted. So a layout-less page that raises a toast
 * creates it and renders it NOWHERE: the user clicks save, or sends an email to
 * every contest participant, and sees absolutely nothing.
 *
 * This was live in three of the four layout-less pages (the contest editor, the
 * contest create page via the same component, and the docs editor) and was found
 * only by an E2E asserting on a success message after a real send. Nothing in
 * the unit suites could see it, because a toast that renders nowhere still
 * "succeeds" in every component test.
 *
 * So: any page that opts out of the layout AND raises toasts must host them
 * itself, either directly or through the single component it renders.
 */

const PAGES_DIR = resolve(__dirname, '..', 'pages');
const COMPONENTS_DIR = resolve(__dirname, '..', 'components');

function allVue(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.vue'))
    .map((f) => resolve(dir, f));
}

const layoutless = allVue(PAGES_DIR).filter((f) => /layout:\s*false/.test(readFileSync(f, 'utf8')));

/** Resolve the components a page renders, so a page can delegate the host. */
function sourcesFor(pageFile: string): string[] {
  const src = readFileSync(pageFile, 'utf8');
  const out = [src];
  // A thin route shell renders one component by name (e.g. <ContestEditor ...>).
  for (const m of src.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) {
    const name = m[1]!;
    for (const c of allVue(COMPONENTS_DIR)) {
      if (resolve(c).endsWith(`/${name}.vue`)) out.push(readFileSync(c, 'utf8'));
    }
  }
  return out;
}

describe('layout-less pages host their own toasts', () => {
  // A scanning test that scans nothing passes vacuously. Pin the floor.
  it('found the layout-less pages to check', () => {
    expect(layoutless.length).toBeGreaterThanOrEqual(4);
  });

  it.each(layoutless.map((f) => [f.slice(PAGES_DIR.length + 1), f]))(
    'pages/%s renders <AppToast /> if anything in it raises a toast',
    (_name, file) => {
      const sources = sourcesFor(file);
      const raisesToast = sources.some((s) => /useToast\(/.test(s));
      if (!raisesToast) return;
      expect(
        sources.some((s) => /<AppToast\b/.test(s)),
        'raises toasts but nothing in its tree mounts <AppToast />, so they render nowhere',
      ).toBe(true);
    },
  );
});
