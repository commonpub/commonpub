/**
 * Tests for <AdminThemeSceneSheet> — the "spec sheet" preview scene.
 * It visualizes tokens (swatches, contrast, type ladder, spacing, tiles)
 * using `var(--*)`, reading resolved values via getComputedStyle. In jsdom
 * custom props don't resolve, so the hex/contrast labels fall back cleanly
 * (no crash, no NaN) — this test guards that fallback + a11y.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import AdminThemeSceneSheet from '../admin/theme/AdminThemeSceneSheet.vue';

function mount() {
  return render(AdminThemeSceneSheet, {
    props: { tokens: { accent: '#5b9cf6', bg: '#101014', text: '#eaeaea' }, modeKey: 'dark' },
  });
}

describe('AdminThemeSceneSheet', () => {
  it('renders the token spec sections without crashing', () => {
    const { container, getByText } = mount();
    expect(getByText('Design tokens')).toBeTruthy();
    // Swatch chips for each declared token row.
    expect(container.querySelectorAll('.cpub-sheet-chip').length).toBeGreaterThan(0);
    // Type ladder + spacing bars present.
    expect(container.querySelectorAll('.cpub-sheet-ladder-row').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.cpub-sheet-space-row').length).toBeGreaterThan(0);
  });

  it('shows blank (not NaN/undefined) for unresolved hex (jsdom has no computed custom props)', () => {
    const { container } = mount();
    const hexes = Array.from(container.querySelectorAll('.cpub-sheet-sw-hex')).map((e) => e.textContent);
    // No NaN/undefined leaked into the labels; unresolved → empty.
    for (const h of hexes) expect(h === '' || /^#|rgb/i.test(h ?? '')).toBe(true);
  });

  it('has no axe violations', async () => {
    const { container } = mount();
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
