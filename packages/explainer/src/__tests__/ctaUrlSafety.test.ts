/**
 * The conclusion call-to-action URL is a scheme sink, and it was an open one.
 *
 * `explainerConclusionSchema` types it `url: z.string()` -- no format check --
 * and `sanitizeExplainerDocument` in @commonpub/server enumerates the fields it
 * cleans by hand and never visits `conclusion.callToAction`. So the value
 * arrives at both renderers exactly as its author typed it, and any member who
 * can write an explainer can type `javascript:`.
 *
 * The 0.9.0 hardening closed the two HTML sinks in this package and did not
 * reach this one, because it is an ATTRIBUTE BINDING rather than a blob of
 * HTML: the Vue viewer binds `:href` directly, and the exporter passed the URL
 * through `escapeAttr`, which neutralises quote-breaking and leaves the scheme
 * untouched. One sink over from the fix, which is this repo's recurring shape.
 *
 * The exported file is the worse of the two: it is opened from disk, with no
 * CSP and no origin.
 *
 * The Vue viewer is covered at the bottom of this file by a source-contract
 * test rather than a mount: this package's vitest config declares neither
 * `@vitejs/plugin-vue` nor jsdom, so a .vue file cannot be rendered here, and
 * wiring a component harness for one assertion is a bigger change than the fix.
 * This mirrors the layer's own by-route guards (see
 * `layers/base/server/api/contests/__tests__/entries-score-gating.test.ts`,
 * which documents the same trade-off).
 */
import { describe, it, expect } from 'vitest';
import { generateExplainerHtml } from '../export/htmlExporter';
import { isSafeUrl } from '../urlSafety';
import type { ExplainerDocument, ExportOptions } from '../types';

const options: ExportOptions = {
  includeAnimations: false,
  inlineImages: false,
  theme: 'base',
  title: 'T',
  description: 'D',
  author: 'A',
};

function docWithCta(url: string): ExplainerDocument {
  // `version: 2` is what `isExplainerDocument` keys on; without it the exporter
  // silently takes the LEGACY path and renders no conclusion at all, which
  // would make every assertion below pass over an empty string.
  return {
    version: 2,
    theme: 'base',
    meta: { description: 'D' },
    hero: { title: 'H', subtitle: 'S' },
    sections: [
      { id: 'sec_1', anchor: 'a', heading: 'A', body: '<p>x</p>' },
    ],
    conclusion: { heading: 'Done', body: '<p>b</p>', callToAction: { label: 'Click me', url } },
  } as unknown as ExplainerDocument;
}

/** What a browser would actually navigate to, taken off the bytes. */
function ctaHref(html: string): string | null {
  const m = /<a class="explainer-conclusion__cta"([^>]*)>/.exec(html);
  if (!m) return null;
  const h = /\shref\s*=\s*"([^"]*)"/.exec(m[1]!);
  return h ? h[1]! : null;
}

const DANGEROUS = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  '   javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'javascript&#58;alert(1)',
  'javascript&#x3a;alert(1)',
  'javasjavascript:cript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
];

const LEGITIMATE = [
  'https://example.com/signup?a=1#b',
  'http://example.com/',
  '/contests/example',
  '#section-2',
  'mailto:hi@example.com',
  'https://example.com/javascript-guide',
];

describe('exported HTML: conclusion CTA', () => {
  it.each(DANGEROUS)('emits no href for %j', (url) => {
    expect(ctaHref(generateExplainerHtml(docWithCta(url), options))).toBeNull();
  });

  it.each(LEGITIMATE)('keeps %j', (url) => {
    expect(ctaHref(generateExplainerHtml(docWithCta(url), options))).toBe(url);
  });

  it('keeps the label even when the href is dropped, so text is not swallowed', () => {
    const html = generateExplainerHtml(docWithCta('javascript:alert(1)'), options);
    expect(html).toContain('Click me');
    expect(html).toContain('explainer-conclusion__cta');
  });

  it('is testing a real exporter, not an empty string', () => {
    // Positive control: every assertion above would pass against a function
    // that returned '' for everything.
    const html = generateExplainerHtml(docWithCta('https://example.com/'), options);
    expect(html.length).toBeGreaterThan(200);
    expect(ctaHref(html)).toBe('https://example.com/');
  });
});

describe('the gate the CTA uses is the package-wide one', () => {
  it('is isSafeUrl, not a second private copy', () => {
    const src = readExporterSource();
    expect(src, 'htmlExporter must route the CTA url through the shared isSafeUrl').toMatch(
      /isSafeUrl\s*\(/,
    );
    for (const bad of DANGEROUS) expect(isSafeUrl(bad)).toBe(false);
    for (const good of LEGITIMATE) expect(isSafeUrl(good)).toBe(true);
  });
});

function readExporterSource(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { resolve } = require('node:path') as typeof import('node:path');
  return readFileSync(resolve(__dirname, '..', 'export', 'htmlExporter.ts'), 'utf8');
}

describe('the Vue viewer binds the gated href, not the raw url', () => {
  const src = readRendererSource();

  it('found the component', () => {
    expect(src.length).toBeGreaterThan(200);
    expect(src).toContain('cpub-conclusion-cta');
  });

  it('imports the shared gate', () => {
    expect(src).toMatch(/import\s*{[^}]*\bisSafeUrl\b[^}]*}\s*from\s*'@commonpub\/explainer'/);
  });

  it('never binds :href straight to callToAction.url', () => {
    expect(
      src,
      ':href is bound to the raw author-supplied url; bind the isSafeUrl-gated computed instead',
    ).not.toMatch(/:href\s*=\s*"[^"]*callToAction\.url/);
  });

  it('binds :href to a computed that consults isSafeUrl', () => {
    const m = /:href\s*=\s*"([A-Za-z0-9_$]+)"/.exec(src);
    expect(m, 'no :href bound to a named computed found').toBeTruthy();
    const name = m![1]!;
    const decl = new RegExp(`const\\s+${name}\\s*=\\s*computed\\(([\\s\\S]*?)\\n\\}\\);`);
    const body = decl.exec(src)?.[1] ?? '';
    expect(body, `${name} must gate on isSafeUrl`).toContain('isSafeUrl');
  });
});

function readRendererSource(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { resolve } = require('node:path') as typeof import('node:path');
  return readFileSync(
    resolve(__dirname, '..', '..', 'vue', 'components', 'viewer', 'ConclusionRenderer.vue'),
    'utf8',
  );
}
