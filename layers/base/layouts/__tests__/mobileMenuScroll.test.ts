/**
 * The mobile menu must be a SCROLL CONTAINER.
 *
 * `.cpub-mobile-menu` is `position: fixed; inset: 0`, so its height is the
 * viewport. Without an overflow rule, every row past the fold is unreachable —
 * not hidden behind a scrollbar, but impossible to reach with any gesture.
 *
 * This is not a hypothetical tall nav. The renderer flattens each dropdown into
 * a section label plus its children, and signing in appends Create / Dashboard /
 * Messages / Notifications. Measured signed in against the reference config:
 *
 *   375x667  802px of menu in 619px of space -> Fediverse, Search, Create,
 *            Dashboard unreachable
 *   360x640  same content in 592px -> worse
 *   390x844  802px in 796px -> overflows by 6px
 *
 * Source-level rather than a mounted component: the defect lives in the
 * layout's own <style> block, which a component test does not apply, and the
 * assertion is about the declaration existing at all.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const layout = readFileSync(resolve(__dirname, '..', 'default.vue'), 'utf8');

/** The `.cpub-mobile-menu { … }` rule body, excluding the @supports override. */
function menuRule(src: string): string {
  const at = src.indexOf('.cpub-mobile-menu {');
  expect(at, 'the .cpub-mobile-menu rule must exist').toBeGreaterThan(-1);
  return src.slice(at, src.indexOf('}', at));
}

describe('mobile menu scrolling', () => {
  const rule = menuRule(layout);

  it('scrolls its own content instead of clipping it', () => {
    expect(rule).toMatch(/overflow-y:\s*auto/);
  });

  it('does not chain the gesture to the page behind the overlay', () => {
    expect(rule).toMatch(/overscroll-behavior:\s*contain/);
  });

  it('keeps momentum scrolling on older iOS', () => {
    expect(rule).toMatch(/-webkit-overflow-scrolling:\s*touch/);
  });

  it('sizes to the DYNAMIC viewport where supported, so the last row clears browser chrome', () => {
    expect(layout).toMatch(/@supports \(height: 100dvh\)/);
    expect(layout).toMatch(/height:\s*calc\(100dvh - var\(--cpub-topbar-height, 48px\)\)/);
  });

  it('is still the full-bleed fixed overlay it was, anchored under the top bar', () => {
    expect(rule).toMatch(/position:\s*fixed/);
    expect(rule).toMatch(/inset:\s*0/);
    expect(rule).toMatch(/top:\s*var\(--cpub-topbar-height, 48px\)/);
  });

  // Positive control: a rename would otherwise make every assertion above
  // vacuous by matching an empty string.
  it('read a layout that actually contains the mobile menu markup', () => {
    expect(layout.length).toBeGreaterThan(5000);
    expect(layout).toContain('class="cpub-mobile-menu"');
    expect(rule.length).toBeGreaterThan(120);
  });
});
