/**
 * Component tests for the P4 banner/cover framing control after the Fill/Fit/Zoom
 * rework. The key guarantee: choosing "Fit" persists a concrete {zoom:0} (the old
 * single-slider defaulted a null banner to the Fit position WITHOUT persisting it,
 * so it stayed null → cover → cropped). CSS mapping is covered in
 * utils/__tests__/contestImage.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import ContestBannerAdjust from '../ContestBannerAdjust.vue';
import type { ContestImageMeta } from '@commonpub/schema';

function mount(modelValue: ContestImageMeta | null = null) {
  const state: { meta: ContestImageMeta | null } = { meta: modelValue };
  const utils = render(ContestBannerAdjust, {
    props: {
      imageUrl: 'https://cdn.test/banner.png',
      aspect: '4 / 1',
      label: 'Banner',
      modelValue,
      'onUpdate:modelValue': (v: ContestImageMeta | null) => { state.meta = v; },
    },
  });
  return { ...utils, state };
}

describe('ContestBannerAdjust — Fill/Fit/Zoom modes', () => {
  it('derives Fill mode from a null meta (the default)', () => {
    const { getByRole } = mount(null);
    expect(getByRole('button', { name: /fill/i }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Fit persists a concrete {zoom:0} even from a null start (the bug fix)', async () => {
    const { getByRole, state } = mount(null);
    await fireEvent.click(getByRole('button', { name: /^fit/i }));
    expect(state.meta).toEqual({ zoom: 0, x: 50, y: 50 });
  });

  it('Fill clears the framing back to null', async () => {
    const { getByRole, state } = mount({ zoom: 0, x: 50, y: 50 });
    await fireEvent.click(getByRole('button', { name: /fill/i }));
    expect(state.meta).toBeNull();
  });

  it('Zoom seeds a positive zoom and reveals the slider', async () => {
    const { getByRole, getByLabelText, rerender, state } = mount(null);
    await fireEvent.click(getByRole('button', { name: /zoom/i }));
    expect(state.meta!.zoom).toBeGreaterThan(0);
    // Reflect the v-model emit back into the prop so the component re-renders in Zoom mode.
    await rerender({ modelValue: state.meta });
    const slider = getByLabelText(/zoom level/i) as HTMLInputElement;
    await fireEvent.update(slider, '0.8');
    expect(state.meta!.zoom).toBeCloseTo(0.8);
  });

  it('the zoom slider only shows in Zoom mode', () => {
    const { queryByLabelText } = mount({ zoom: 0, x: 50, y: 50 }); // Fit mode
    expect(queryByLabelText(/zoom level/i)).toBeNull();
  });

  it('applies the framing style to the preview image', () => {
    const { getByAltText } = mount({ zoom: 0.5, x: 20, y: 80 });
    const img = getByAltText('Banner') as HTMLImageElement;
    expect(img.style.objectFit).toBe('cover');
    expect(img.style.transform).toBe('scale(1.5)');
    expect(img.style.objectPosition).toBe('20% 80%');
  });

  it('has no axe violations', async () => {
    const { container } = mount({ zoom: 0.3, x: 50, y: 50 });
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
