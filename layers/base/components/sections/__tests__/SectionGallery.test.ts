/**
 * Component-level tests for SectionGallery.
 * Pure render — no fetch. Asserts grid + image attributes + caption +
 * optional href wrap.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/vue';
import SectionGallery from '../SectionGallery.vue';

const meta = {
  route: '/',
  zone: 'main',
  isPreview: false,
  effectiveColSpan: 12,
  sectionId: 'gal-1',
};

interface GalleryConfigForTest extends Record<string, unknown> {
  heading: string;
  columns: 2 | 3 | 4 | 5;
  aspectRatio: 'square' | '4/3' | '16/9' | '3/4' | 'auto';
  items: Array<{ src: string; alt: string; caption: string; href: string }>;
}

const baseConfig: GalleryConfigForTest = {
  heading: '',
  columns: 3,
  aspectRatio: 'square',
  items: [],
};

afterEach(() => { document.body.innerHTML = ''; });

describe('SectionGallery — render', () => {
  it('renders nothing when no items', () => {
    render(SectionGallery, { props: { meta, config: baseConfig } });
    expect(document.querySelector('.cpub-section-gallery')).toBeNull();
  });

  it('renders one <li> per item', () => {
    render(SectionGallery, { props: { meta, config: {
      ...baseConfig,
      items: [
        { src: '/a.jpg', alt: 'A', caption: '', href: '' },
        { src: '/b.jpg', alt: 'B', caption: '', href: '' },
        { src: '/c.jpg', alt: 'C', caption: '', href: '' },
      ],
    }}});
    expect(document.querySelectorAll('.cpub-section-gallery-item').length).toBe(3);
  });

  it('renders <img> with src, alt, loading=lazy', () => {
    render(SectionGallery, { props: { meta, config: {
      ...baseConfig,
      items: [{ src: 'https://cdn.example/x.jpg', alt: 'photo', caption: '', href: '' }],
    }}});
    const img = document.querySelector('.cpub-section-gallery-img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.example/x.jpg');
    expect(img.getAttribute('alt')).toBe('photo');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('wraps img in <a> when href set, in <div> when not', () => {
    render(SectionGallery, { props: { meta, config: {
      ...baseConfig,
      items: [{ src: '/a.jpg', alt: '', caption: '', href: '/landing' }],
    }}});
    const link = document.querySelector('.cpub-section-gallery-link') as HTMLAnchorElement;
    expect(link.tagName.toLowerCase()).toBe('a');
    expect(link.getAttribute('href')).toBe('/landing');

    document.body.innerHTML = '';
    render(SectionGallery, { props: { meta, config: {
      ...baseConfig,
      items: [{ src: '/a.jpg', alt: '', caption: '', href: '' }],
    }}});
    const div = document.querySelector('.cpub-section-gallery-link');
    expect(div?.tagName.toLowerCase()).toBe('div');
  });

  it('renders caption only when set', () => {
    render(SectionGallery, { props: { meta, config: {
      ...baseConfig,
      items: [{ src: '/a.jpg', alt: '', caption: 'A caption', href: '' }],
    }}});
    expect(document.querySelector('.cpub-section-gallery-caption')?.textContent?.trim()).toBe('A caption');

    document.body.innerHTML = '';
    render(SectionGallery, { props: { meta, config: {
      ...baseConfig,
      items: [{ src: '/a.jpg', alt: '', caption: '', href: '' }],
    }}});
    expect(document.querySelector('.cpub-section-gallery-caption')).toBeNull();
  });

  it.each([2, 3, 4, 5] as const)('exposes data-columns=%d', (cols) => {
    render(SectionGallery, { props: { meta, config: {
      ...baseConfig, columns: cols,
      items: [{ src: '/a.jpg', alt: '', caption: '', href: '' }],
    }}});
    expect(document.querySelector('.cpub-section-gallery-grid')?.getAttribute('data-columns')).toBe(String(cols));
  });

  it.each(['square', '4/3', '16/9', '3/4', 'auto'] as const)(
    'exposes data-aspect=%s per item',
    (ratio) => {
      render(SectionGallery, { props: { meta, config: {
        ...baseConfig, aspectRatio: ratio,
        items: [{ src: '/a.jpg', alt: '', caption: '', href: '' }],
      }}});
      expect(document.querySelector('.cpub-section-gallery-item')?.getAttribute('data-aspect')).toBe(ratio);
    },
  );

  it('exposes data-lightbox-id with unique-per-item value (Phase 10 hook)', () => {
    render(SectionGallery, { props: { meta, config: {
      ...baseConfig,
      items: [
        { src: '/a.jpg', alt: '', caption: '', href: '' },
        { src: '/b.jpg', alt: '', caption: '', href: '' },
      ],
    }}});
    const imgs = document.querySelectorAll('.cpub-section-gallery-img');
    expect(imgs[0]?.getAttribute('data-lightbox-id')).toBe(`${meta.sectionId}-0`);
    expect(imgs[1]?.getAttribute('data-lightbox-id')).toBe(`${meta.sectionId}-1`);
  });
});
