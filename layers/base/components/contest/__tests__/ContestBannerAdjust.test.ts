/**
 * Component tests for the P4 banner/cover framing control. The CSS mapping is
 * covered in utils/__tests__/contestImage.test.ts; these assert the v-model wiring
 * (zoom slider + reset) and that the preview applies the shared framing.
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

describe('ContestBannerAdjust', () => {
  it('emits a meta with the chosen zoom (seeding x/y to centre)', async () => {
    const { getByLabelText, state } = mount(null);
    await fireEvent.update(getByLabelText(/zoom/i), '0.5');
    expect(state.meta).toEqual({ zoom: 0.5, x: 50, y: 50 });
  });

  it('reset clears the framing back to null', async () => {
    const { getByRole, state } = mount({ zoom: 0.8, x: 30, y: 70 });
    await fireEvent.click(getByRole('button', { name: /reset/i }));
    expect(state.meta).toBeNull();
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
