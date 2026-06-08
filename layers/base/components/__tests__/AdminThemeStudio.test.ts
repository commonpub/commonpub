/**
 * Tests for <AdminThemeStudio> — the guided theme generator.
 *
 * Covers the contract the editor relies on:
 *  - changing any control re-emits `generate` with a full, canonical token
 *    map (the projection output) so the shared draft + preview update live
 *  - the dice roll emits `generate` AND a `roll` name suggestion
 *  - the final step emits `finish` (hand-off to the advanced editor)
 *  - no axe violations
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import { validateTokenOverrides } from '@commonpub/ui';
import AdminThemeStudio from '../admin/theme/studio/AdminThemeStudio.vue';

type GeneratePayload = {
  recipe: Record<string, unknown>;
  tokens: Record<string, string>;
  fonts: string[];
  parentTheme: 'base' | 'dark';
  isDark: boolean;
};

function lastEmit<T>(emitted: Record<string, unknown[]>, name: string): T | undefined {
  const calls = emitted[name];
  if (!calls || calls.length === 0) return undefined;
  const last = calls[calls.length - 1] as unknown[];
  return last[0] as T;
}

describe('AdminThemeStudio — generate contract', () => {
  it('emits a full canonical token map when a vibe palette is picked', async () => {
    const { container, emitted } = render(AdminThemeStudio);
    // Step 1 (Color) is active; click the first palette chip.
    const chip = container.querySelector('.cpub-studio-palchip');
    expect(chip).toBeTruthy();
    await fireEvent.click(chip!);

    const payload = lastEmit<GeneratePayload>(emitted() as Record<string, unknown[]>, 'generate');
    expect(payload).toBeTruthy();
    // Every emitted key must be a canonical CommonPub token.
    expect(validateTokenOverrides(payload!.tokens).invalid).toEqual([]);
    // Core tokens are always present.
    expect(payload!.tokens['accent']).toBeTruthy();
    expect(payload!.tokens['bg']).toBeTruthy();
    expect(['base', 'dark']).toContain(payload!.parentTheme);
  });

  it('dice roll emits both generate and a roll name suggestion', async () => {
    const { getByText, emitted } = render(AdminThemeStudio);
    await fireEvent.click(getByText('Roll'));
    const e = emitted() as Record<string, unknown[]>;
    expect(e['generate']?.length).toBeGreaterThan(0);
    const roll = lastEmit<{ name: string }>(e, 'roll');
    expect(roll?.name).toMatch(/^[A-Z]+$/);
  });

  it('switching to Light mode (custom tab) flips the emitted parentTheme to base', async () => {
    const { getByText, emitted } = render(AdminThemeStudio);
    await fireEvent.click(getByText('My colors'));
    await fireEvent.click(getByText('Light'));
    const payload = lastEmit<GeneratePayload>(emitted() as Record<string, unknown[]>, 'generate');
    expect(payload?.parentTheme).toBe('base');
    expect(payload?.isDark).toBe(false);
  });

  it('picking a type vibe writes the chosen display font into the emitted tokens', async () => {
    const { getByText, container, emitted } = render(AdminThemeStudio);
    await fireEvent.click(getByText('Next')); // → Type step
    // Default tab is "By vibe"; click the first vibe card (Editorial → Playfair Display).
    const firstVibeCard = container.querySelector('.cpub-studio-vcard');
    expect(firstVibeCard).toBeTruthy();
    await fireEvent.click(firstVibeCard!);
    const payload = lastEmit<GeneratePayload>(emitted() as Record<string, unknown[]>, 'generate');
    expect(payload?.tokens['font-display']).toContain('Playfair Display');
    expect(payload?.fonts).toContain('Playfair Display');
  });

  it('reaching the last step and finishing emits `finish`', async () => {
    const { getByText, emitted } = render(AdminThemeStudio);
    // Walk Next through Color → Type → Shape → Feel.
    for (let i = 0; i < 3; i++) await fireEvent.click(getByText('Next'));
    await fireEvent.click(getByText(/Generate & edit/));
    expect((emitted() as Record<string, unknown[]>)['finish']?.length).toBeGreaterThan(0);
  });

  it('seeds its controls from a provided recipe (opens on My colors tab)', () => {
    const recipe = {
      mode: 'light' as const,
      accent: '#c8643c',
      scheme: 'complementary' as const,
      fonts: { display: 'Fraunces', body: 'Inter', ui: 'Space Mono', code: 'JetBrains Mono' },
      baseSize: 16,
      ratio: 1.25,
      spaceBase: 4 as const,
      density: 'balanced' as const,
      shapeRadius: 6,
      borderWidth: 2,
      shadowStyle: 'soft' as const,
      motion: 'snappy' as const,
    };
    const { container } = render(AdminThemeStudio, { props: { recipe } });
    // Custom tab is active when a recipe is provided → accent hex input present.
    const hex = container.querySelector('.cpub-studio-mono') as HTMLInputElement | null;
    expect(hex?.value).toBe('#c8643c');
  });
});

describe('AdminThemeStudio — a11y', () => {
  it('has no axe violations', async () => {
    const { container } = render(AdminThemeStudio);
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
