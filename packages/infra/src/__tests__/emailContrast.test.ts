import { describe, it, expect } from 'vitest';
import { emailTemplates } from '../email/templates.js';
import { onAccent } from '../email/render.js';

/**
 * Colour contrast in delivered email, measured from the HTML we actually emit.
 *
 * This exists because the shell and the block renderer disagreed for a long
 * time: the shell was near-black with light grey text, while the block styles
 * assumed a light page. The callout set a near-white background and inherited
 * the shell's light foreground, which measures 1.24:1 -- text you cannot read.
 * The blockquote measured 2.66:1 and the CTA label 2.71:1 on a dark brand accent.
 *
 * Asserting on the constants would not have caught it, because each constant was
 * individually reasonable; only the PAIRS were wrong. So parse the output.
 */

const lum = (hex: string): number => {
  const ch = (hex.replace('#', '').match(/../g) ?? []).map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
};
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const AA = 4.5;

/** Expand `#abc` to `#aabbcc` so a short hex is never silently skipped -- an
 *  earlier version of this file filtered on a 6-hex regex, so a mutant that
 *  hardcoded `color:#000` slipped straight through the check. */
function hex6(v: string): string | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v.trim());
  if (!m) return null;
  const h = m[1]!;
  return '#' + (h.length === 3 ? h.split('').map((c) => c + c).join('') : h);
}

/** Read one declaration out of the FIRST style attribute that contains it. */
function decl(html: string, prop: string, near: RegExp): string | null {
  for (const m of html.matchAll(/style="([^"]*)"/g)) {
    const css = m[1]!;
    if (!near.test(css)) continue;
    const d = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(css);
    if (d) return d[1]!.trim();
  }
  return null;
}

const ACCENTS = ['#5b9cf6', '#aa0000', '#111111', '#ffee00', '#0a1a1c'];

function render(accent: string): string {
  return emailTemplates.contestAnnouncement({
    siteName: 'Test',
    subject: 'S',
    contest: { title: 'C', url: 'https://x.test/c' },
    bodyHtml:
      '<p style="margin:0 0 16px;line-height:1.6;">body</p>' +
      '<blockquote style="margin:0 0 16px;padding:8px 16px;border-left:3px solid ' + accent + ';">quote</blockquote>' +
      '<div style="margin:0 0 16px;padding:12px 16px;border:1px solid ' + accent + ';background:#eef4ff;color:#1a2230;">callout</div>',
    bodyText: 'body',
    tokens: {},
    unsubscribeUrl: 'https://x.test/u',
    branding: { accentColor: accent },
  }).html;
}

describe('email colour contrast', () => {
  // Every assertion below reads a colour OUT of the rendered mail. Asserting on
  // the source constants instead is what let four reverting mutants survive an
  // earlier version of this file.
  const html = render('#aa0000');

  const pageBg = hex6(decl(html, 'background', /margin:0;padding:0/) ?? '');
  const cardBg = hex6(decl(html, 'background', /border:1px solid/) ?? '');
  const bodyFg = hex6(decl(html, 'color', /font-size:16px/) ?? '');
  const footFg = hex6(decl(html, 'color', /border-top:1px solid/) ?? '');
  const btnBg = hex6(decl(html, 'background', /display:inline-block/) ?? '');
  const btnFg = hex6(decl(html, 'color', /display:inline-block/) ?? '');

  it('found every colour it means to check (a vacuous guard is worse than none)', () => {
    expect({ pageBg, cardBg, bodyFg, footFg, btnBg, btnFg }).not.toHaveProperty('pageBg', null);
    for (const [k, v] of Object.entries({ pageBg, cardBg, bodyFg, footFg, btnBg, btnFg })) {
      expect(v, `could not read ${k} out of the rendered mail`).toBeTruthy();
    }
  });

  it('renders a LIGHT shell, matching every instance actually running', () => {
    expect(lum(pageBg!)).toBeGreaterThan(0.5);
    expect(lum(cardBg!)).toBeGreaterThan(0.5);
  });

  // Both metas AND the body declaration, each asserted by name: a looser
  // `toContain('content="light"')` passed while the color-scheme meta was
  // deleted, because the supported-color-schemes meta also matched it.
  it('declares color-scheme so clients do not invert it again', () => {
    expect(html).toMatch(/<meta name="color-scheme" content="light">/);
    expect(html).toMatch(/<meta name="supported-color-schemes" content="light">/);
    expect(html).toMatch(/color-scheme:light/);
  });

  it('body text passes AA on the card', () => {
    expect(ratio(bodyFg!, cardBg!)).toBeGreaterThanOrEqual(AA);
  });

  it('footer text passes AA on the card (it used to be 3.45:1)', () => {
    expect(ratio(footFg!, cardBg!)).toBeGreaterThanOrEqual(AA);
  });

  it('the CTA label passes AA on the accent (it used to be 2.71:1 on deveco red)', () => {
    expect(ratio(btnFg!, btnBg!)).toBeGreaterThanOrEqual(AA);
  });

  it('the callout, which used to measure 1.24:1, passes AA', () => {
    const cHtml = render('#5b9cf6');
    const bg = hex6(decl(cHtml, 'background', /padding:12px 16px/) ?? '');
    const fg = hex6(decl(cHtml, 'color', /padding:12px 16px/) ?? '');
    expect(bg, 'callout background').toBeTruthy();
    expect(fg, 'callout foreground').toBeTruthy();
    expect(ratio(fg!, bg!)).toBeGreaterThanOrEqual(AA);
  });

  describe('the CTA label is derived from the accent, across brands', () => {
    it.each(ACCENTS)('reads against accent %s', (accent) => {
      const h = render(accent);
      const bg = hex6(decl(h, 'background', /display:inline-block/) ?? '');
      const fg = hex6(decl(h, 'color', /display:inline-block/) ?? '');
      expect(bg, accent).toBeTruthy();
      expect(ratio(fg!, bg!), `label on ${accent}`).toBeGreaterThanOrEqual(AA);
    });

    it('picks black on a light accent and white on a dark one', () => {
      expect(onAccent('#ffee00')).toBe('#000000');
      expect(onAccent('#aa0000')).toBe('#ffffff');
    });
  });
});
