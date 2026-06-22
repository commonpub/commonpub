import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import ContestMediaStrip from '../ContestMediaStrip.vue';

// Stub the inner ImageUpload (its crop/upload internals are tested elsewhere and
// pull Nuxt composables); this focuses on the strip wiring: two labelled zones
// above the canvas, and v-model forwarding back to the editor model.
const ImageUpload = {
  props: ['modelValue', 'purpose', 'label', 'hint'],
  emits: ['update:modelValue'],
  template:
    '<div class="cpub-img-upload-stub" :data-purpose="purpose"><span class="lbl">{{ label }}</span>' +
    '<button type="button" class="emit" @click="$emit(\'update:modelValue\', purpose + \'-url\')">set {{ purpose }}</button></div>',
};
const stubs = { ImageUpload };

describe('ContestMediaStrip', () => {
  it('renders a banner and a cover placeholder zone', () => {
    const { container } = render(ContestMediaStrip, {
      props: { bannerUrl: '', coverImageUrl: '' },
      global: { stubs },
    });
    const banner = container.querySelector('[data-purpose="banner"]');
    const cover = container.querySelector('[data-purpose="cover"]');
    expect(banner).toBeTruthy();
    expect(cover).toBeTruthy();
    expect(banner?.querySelector('.lbl')?.textContent).toContain('Banner');
    expect(cover?.querySelector('.lbl')?.textContent).toContain('Cover');
  });

  it('passes the current urls down to each zone', () => {
    const { container } = render(ContestMediaStrip, {
      props: { bannerUrl: 'b.png', coverImageUrl: 'c.png' },
      global: {
        stubs: {
          ImageUpload: {
            props: ['modelValue', 'purpose', 'label', 'hint'],
            template: '<div :data-purpose="purpose" :data-url="modelValue" />',
          },
        },
      },
    });
    expect(container.querySelector('[data-purpose="banner"]')?.getAttribute('data-url')).toBe('b.png');
    expect(container.querySelector('[data-purpose="cover"]')?.getAttribute('data-url')).toBe('c.png');
  });

  it('forwards the banner update via update:bannerUrl', async () => {
    const { container, emitted } = render(ContestMediaStrip, {
      props: { bannerUrl: '', coverImageUrl: '' },
      global: { stubs },
    });
    const btn = container.querySelector('[data-purpose="banner"] .emit') as HTMLElement;
    await fireEvent.click(btn);
    expect(emitted('update:bannerUrl')?.[0]).toEqual(['banner-url']);
    expect(emitted('update:coverImageUrl')).toBeUndefined();
  });

  it('forwards the cover update via update:coverImageUrl', async () => {
    const { container, emitted } = render(ContestMediaStrip, {
      props: { bannerUrl: '', coverImageUrl: '' },
      global: { stubs },
    });
    const btn = container.querySelector('[data-purpose="cover"] .emit') as HTMLElement;
    await fireEvent.click(btn);
    expect(emitted('update:coverImageUrl')?.[0]).toEqual(['cover-url']);
    expect(emitted('update:bannerUrl')).toBeUndefined();
  });

  it('passes an axe scan', async () => {
    const { container } = render(ContestMediaStrip, {
      props: { bannerUrl: '', coverImageUrl: '' },
      global: { stubs },
    });
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
