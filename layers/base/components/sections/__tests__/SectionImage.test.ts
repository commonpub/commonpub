/**
 * Component-level tests for SectionImage — covers the <img>/<placeholder>
 * switch, optional <a> wrapping, and caption rendering.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import SectionImage from '../SectionImage.vue';

const meta = {
  route: '/',
  zone: 'main',
  isPreview: false,
  effectiveColSpan: 12,
  sectionId: 'img-1',
};

const baseConfig = {
  src: '',
  alt: '',
  caption: '',
  href: '',
  fit: 'contain' as const,
  aspectRatio: 'auto' as const,
};

describe('SectionImage', () => {
  it('renders an <img> with src + alt + lazy + async decoding', () => {
    render(SectionImage, {
      props: {
        meta,
        config: { ...baseConfig, src: 'https://example.com/x.png', alt: 'a kitten' },
      },
    });
    const img = document.querySelector('img.cpub-section-image-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/x.png');
    expect(img?.getAttribute('alt')).toBe('a kitten');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('decoding')).toBe('async');
  });

  it('renders a placeholder (no <img>) when src is empty', () => {
    render(SectionImage, { props: { meta, config: baseConfig } });
    expect(document.querySelector('img.cpub-section-image-img')).toBeNull();
    expect(document.querySelector('.cpub-section-image-placeholder')).not.toBeNull();
  });

  it('wraps the frame in <a href> when href is set; bare <div> otherwise', () => {
    render(SectionImage, {
      props: {
        meta,
        config: { ...baseConfig, src: 'x.png', alt: 'x', href: 'https://example.com/article' },
      },
    });
    const a = document.querySelector('a.cpub-section-image-frame') as HTMLAnchorElement | null;
    expect(a).not.toBeNull();
    expect(a?.getAttribute('href')).toBe('https://example.com/article');
  });

  it('uses <div> wrapper when href is empty (a11y — no fake link)', () => {
    render(SectionImage, {
      props: { meta, config: { ...baseConfig, src: 'x.png', alt: 'x', href: '' } },
    });
    const a = document.querySelector('a.cpub-section-image-frame');
    const div = document.querySelector('div.cpub-section-image-frame');
    expect(a).toBeNull();
    expect(div).not.toBeNull();
  });

  it('renders figcaption only when caption is set', () => {
    render(SectionImage, {
      props: {
        meta,
        config: { ...baseConfig, src: 'x.png', alt: 'x', caption: 'A grainy photo' },
      },
    });
    const cap = document.querySelector('figcaption.cpub-section-image-caption');
    expect(cap?.textContent?.trim()).toBe('A grainy photo');
  });

  it('exposes data-aspect + data-fit for CSS to consume', () => {
    render(SectionImage, {
      props: {
        meta,
        config: { ...baseConfig, src: 'x.png', alt: 'x', fit: 'cover', aspectRatio: '16/9' },
      },
    });
    const fig = document.querySelector('figure.cpub-section-image');
    expect(fig?.getAttribute('data-fit')).toBe('cover');
    expect(fig?.getAttribute('data-aspect')).toBe('16/9');
  });
});
